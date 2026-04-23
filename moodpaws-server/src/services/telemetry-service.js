import {
  getLatestMessage,
  getLatestMessageByDeviceName,
  listLatestMetricPoints,
  listMetricHistory,
  listRecentMessages,
  listRecentMotionSamples,
  listTrackPoints
} from '../db/repositories/telemetry-repo.js'
import { parsePayloadObject } from '../mqtt/parser.js'
import { getMoodLabel } from '../utils/emotion-mood.js'

const STEP_THRESHOLD = 1.2
const STEP_SAMPLE_LIMIT = 240
const DEFAULT_TELEMETRY_DEVICE = 'Collar'
const HOUSE_DEVICE = 'DogHouse'
const TRACK_WINDOW_MS = 24 * 60 * 60 * 1000
const ONLINE_WINDOW_MS = 60 * 1000
const TELEMETRY_METRIC_KEYS = [
  'EmotionState',
  'Collar:temp',
  'Collar:GPS.Longitude',
  'Collar:GPS.Latitude',
  'Collar:BNO085.X',
  'Collar:BNO085.Y',
  'Collar:BNO085.Z',
  'Collar:MAX30102.HeartRate',
  'Collar:MAX30102.SPO2'
]

const isValidTrackPoint = (longitude, latitude) =>
  Number.isFinite(longitude) &&
  Number.isFinite(latitude) &&
  longitude >= -180 &&
  longitude <= 180 &&
  latitude >= -90 &&
  latitude <= 90

export async function getLatestTelemetry() {
  const [latestMessage, latestCollarMessage, latestHouseMessage, latestMetricPoints, motionSamples] = await Promise.all([
    getLatestMessage(),
    getLatestMessageByDeviceName(DEFAULT_TELEMETRY_DEVICE),
    getLatestMessageByDeviceName(HOUSE_DEVICE),
    listLatestMetricPoints(TELEMETRY_METRIC_KEYS),
    listRecentMotionSamples(STEP_SAMPLE_LIMIT)
  ])

  const baseMessage = latestMessage || latestCollarMessage || latestHouseMessage

  if (!baseMessage) {
    return {
      source: {
        deviceName: '--',
        requestId: '--',
        createdAt: null
      },
      sections: [],
      stepCount: 0,
      isOnline: false,
      lastActiveAt: null
    }
  }

  const collarParsed = latestCollarMessage
    ? parsePayloadObject(JSON.parse(latestCollarMessage.payload_json), latestCollarMessage.topic)
    : null
  const houseParsed = latestHouseMessage
    ? parsePayloadObject(JSON.parse(latestHouseMessage.payload_json), latestHouseMessage.topic)
    : null
  const baseParsed = parsePayloadObject(JSON.parse(baseMessage.payload_json), baseMessage.topic)
  const sections = mergeSections(baseParsed.sections, collarParsed?.sections, houseParsed?.sections)
  const latestMetrics = createLatestMetricMap(latestMetricPoints)
  hydrateSectionsWithLatestMetrics(sections, latestMetrics)

  const lastActiveAt = Math.max(
    Number(latestCollarMessage?.received_at) || 0,
    Number(latestHouseMessage?.received_at) || 0,
    Number(latestMessage?.received_at) || 0
  ) || null

  return {
    source: baseParsed.source,
    sections,
    raw: baseParsed.raw,
    receivedAt: baseMessage.received_at,
    topic: baseMessage.topic,
    stepCount: calculateStepCount(motionSamples),
    isOnline: Boolean(lastActiveAt && Date.now() - lastActiveAt <= ONLINE_WINDOW_MS),
    lastActiveAt
  }
}

export async function getRecentMessages(limit = 50) {
  return listRecentMessages(limit)
}

export async function getMetricHistory(metricKey, limit = 100) {
  const rows = await listMetricHistory(metricKey, limit)
  return {
    metricKey,
    points: rows
      .map((row) => ({
        value: row.value_num ?? row.value_text,
        time: row.ts
      }))
      .reverse()
  }
}

export async function getLocationTrack(limit = 1440) {
  const sinceTs = Date.now() - TRACK_WINDOW_MS
  const rows = await listTrackPoints(limit, sinceTs)
  return {
    points: rows
      .map((row) => ({
        longitude: row.longitude,
        latitude: row.latitude,
        time: row.ts
      }))
      .filter((point) => isValidTrackPoint(Number(point.longitude), Number(point.latitude)))
      .reverse()
  }
}

export async function getLatestEmotion() {
  const [latestHouseMessage, latestMessage, latestMoodRows] = await Promise.all([
    getLatestMessageByDeviceName(HOUSE_DEVICE),
    getLatestMessage(),
    listLatestMetricPoints(['EmotionState'])
  ])
  const moodMetric =
    extractLatestEmotionMetric(latestHouseMessage) ||
    extractLatestEmotionMetric(latestMessage) ||
    extractMoodFromMetricPoint(latestMoodRows[0])
  const telemetryMood = moodMetric
    ? getMoodLabel(moodMetric.valueNum ?? moodMetric.rawValue ?? moodMetric.value)
    : null

  if (!telemetryMood) {
    return createEmptyEmotionPayload()
  }

  return {
    ...createEmptyEmotionPayload(),
    source: 'telemetry',
    currentMood: telemetryMood,
    createdAt: Number(moodMetric.ts ?? moodMetric.time) || null
  }
}

function createEmptyEmotionPayload() {
  return {
    source: '',
    currentMood: '',
    score: null,
    voice: {
      frequency: [],
      tone: []
    },
    fluctuation: {
      timeline: [],
      values: []
    },
    history: [],
    createdAt: null
  }
}

function extractLatestEmotionMetric(message) {
  if (!message?.payload_json) {
    return null
  }

  const parsed = parsePayloadObject(JSON.parse(message.payload_json), message.topic)
  return parsed.metricPoints.find((metric) => metric.metricKey === 'EmotionState') || null
}

function extractMoodFromMetricPoint(row) {
  if (!row) {
    return null
  }

  return {
    value: row.value_num ?? row.value_text,
    ts: row.ts
  }
}

function mergeSections(baseSections = [], ...sectionGroups) {
  const merged = new Map(
    baseSections.map((section) => [
      section.key,
      {
        ...section,
        metrics: section.metrics.map((metric) => ({ ...metric }))
      }
    ])
  )

  for (const sections of sectionGroups) {
    if (!Array.isArray(sections)) continue

    for (const section of sections) {
      if (!merged.has(section.key)) {
        merged.set(section.key, {
          ...section,
          metrics: section.metrics.map((metric) => ({ ...metric }))
        })
        continue
      }

      const target = merged.get(section.key)
      const metricsByKey = new Map(target.metrics.map((metric) => [metric.key, metric]))

      for (const metric of section.metrics) {
        if (!metricsByKey.has(metric.key)) {
          target.metrics.push({ ...metric })
          metricsByKey.set(metric.key, target.metrics.at(-1))
          continue
        }

        if (metric.value !== '--' && metric.value !== null && metric.value !== undefined) {
          const current = metricsByKey.get(metric.key)
          current.value = metric.value
          current.time = metric.time
        }
      }
    }
  }

  return Array.from(merged.values())
}

function createLatestMetricMap(rows = []) {
  return rows.reduce((result, row) => {
    result[row.metric_key] = {
      value: row.value_num ?? row.value_text,
      time: row.ts
    }
    return result
  }, {})
}

function hydrateSectionsWithLatestMetrics(sections = [], latestMetrics = {}) {
  for (const section of sections) {
    for (const metric of section.metrics || []) {
      const latestMetric = latestMetrics[metric.key]
      if (!latestMetric) continue
      if (metric.value !== '--' && metric.value !== null && metric.value !== undefined) continue
      metric.value = latestMetric.value
      metric.time = latestMetric.time
    }
  }
}

function calculateStepCount(samples) {
  if (!Array.isArray(samples) || samples.length < 2) {
    return 0
  }

  const orderedSamples = [...samples].reverse()
  let lastMagnitude = 0
  let stepCount = 0

  for (const sample of orderedSamples) {
    const x = Number(sample.x) || 0
    const y = Number(sample.y) || 0
    const z = Number(sample.z) || 0
    const magnitude = Math.sqrt(x * x + y * y + z * z)

    if (lastMagnitude > 0 && Math.abs(magnitude - lastMagnitude) > STEP_THRESHOLD) {
      stepCount += 1
    }

    lastMagnitude = magnitude
  }

  return stepCount
}
