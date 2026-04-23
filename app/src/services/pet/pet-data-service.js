import {
  aliyunIotConfig,
  getAliyunIotMissingFields,
  isAliyunMqttConfigured,
  isAliyunIotConfigured
} from '../../config/aliyun-iot'
import {
  queryDevicePropertyHistory,
  queryDevicePropertyStatus
} from '../aliyun/iot-openapi'
import {
  ensureAliyunMqttStarted,
  getAliyunMqttState
} from '../aliyun/iot-mqtt'
import {
  createMetricSections,
  flattenPropertyRecord,
  getDisplayValue,
  getEmotionLabel,
  getHistoryPropertyDefinitions,
  getMetricNumericValue
} from './metric-definitions'
import { petLocalStore } from './local-store'

const LATEST_SYNC_DEDUP_MS = 2500
const HISTORY_SYNC_DEDUP_MS = 8000
const HEART_RATE_METRIC_KEY = 'Collar:MAX30102.HeartRate'
const EMOTION_METRIC_KEY = 'EmotionState'
const LOCATION_METRIC_KEYS = ['Collar:GPS.Longitude', 'Collar:GPS.Latitude', 'Collar:GPS.Accuracy']

let latestSyncPromise = null
let lastLatestSyncAt = 0
const historySyncPromises = new Map()
const lastHistorySyncAt = new Map()

export async function loadLatestTelemetry(options = {}) {
  const syncError = await syncLatestSafely(options)
  const latestPoints = await petLocalStore.getLatestMetricPoints()
  if (!latestPoints.length && syncError) {
    throw syncError
  }
  const stepCount = await calculateTodayStepCount()
  return buildTelemetry(latestPoints, stepCount)
}

export async function loadHeartRateHistory(options = {}) {
  const limit = Math.max(1, Number(options.limit) || 30)
  const syncError = await syncHistorySafely({
    metricKeys: [HEART_RATE_METRIC_KEY],
    force: options.force === true
  })
  const points = await petLocalStore.getMetricHistory(HEART_RATE_METRIC_KEY, limit)
  if (!points.length && syncError) {
    throw syncError
  }

  return {
    points: points
      .map((point) => ({
        value: getMetricNumericValue(point),
        time: Number(point.ts)
      }))
      .filter((point) => Number.isFinite(point.value) && Number.isFinite(point.time))
  }
}

export async function loadLocationTrack(options = {}) {
  const limit = Math.max(1, Number(options.limit) || 200)
  const syncError = await syncHistorySafely({
    metricKeys: LOCATION_METRIC_KEYS,
    force: options.force === true
  })
  const points = await petLocalStore.getLocationTrack(limit)
  if (!points.length && syncError) {
    throw syncError
  }

  return {
    points
  }
}

export async function loadLatestEmotion(options = {}) {
  const syncError = await syncLatestSafely(options)
  const emotionPoint = await petLocalStore.getLatestMetricPoint(EMOTION_METRIC_KEY)
  if (!emotionPoint && syncError) {
    throw syncError
  }
  const currentMood = resolveEmotionLabel(emotionPoint)

  return {
    source: emotionPoint ? 'aliyun-iot' : '',
    currentMood,
    score: currentMood ? getEmotionScore(currentMood) : null,
    voice: { frequency: [], tone: [] },
    fluctuation: { timeline: [], values: [] },
    history: createEmotionSummary(currentMood),
    createdAt: Number(emotionPoint?.ts) || null
  }
}

export function getLocalStorageModeLabel() {
  return petLocalStore.isUsingSqlite() ? 'SQLite' : '本地缓存'
}

async function syncLatestSafely(options) {
  try {
    await ensureRealtimeSyncStarted()
    await syncLatestIfNeeded(options)
    return null
  } catch (error) {
    await petLocalStore.init()
    return error
  }
}

async function syncHistorySafely(options) {
  try {
    await ensureRealtimeSyncStarted()
    await syncHistoryIfNeeded(options)
    return null
  } catch (error) {
    await petLocalStore.init()
    return error
  }
}

async function syncLatestIfNeeded(options = {}) {
  const shouldSync = options.syncCloud !== false && isAliyunIotConfigured()
  if (!shouldSync) {
    await petLocalStore.init()
    return
  }

  const now = Date.now()
  if (!options.force && latestSyncPromise) {
    return latestSyncPromise
  }

  if (!options.force && now - lastLatestSyncAt < LATEST_SYNC_DEDUP_MS) {
    return
  }

  latestSyncPromise = syncLatestFromCloud()
    .then(() => {
      lastLatestSyncAt = Date.now()
    })
    .finally(() => {
      latestSyncPromise = null
    })

  return latestSyncPromise
}

async function syncLatestFromCloud() {
  await ensureCloudReady()
  const pointGroups = await Promise.all(
    aliyunIotConfig.devices.map(async (deviceName) => {
      const payload = await queryDevicePropertyStatus(deviceName)
      const statusItems = extractStatusItems(payload)

      return statusItems.flatMap((item) =>
        flattenPropertyRecord({
          productKey: aliyunIotConfig.productKey,
          deviceName,
          identifier: item.Identifier || item.identifier,
          value: item.Value ?? item.value,
          time: item.Time ?? item.time,
          gmtCreate: item.GmtCreate ?? item.gmtCreate
        })
      )
    })
  )

  const points = pointGroups.flat()
  if (points.length) {
    await petLocalStore.upsertMetricPoints(points)
  }

  await petLocalStore.setMeta('latestSyncAt', Date.now())
}

async function syncHistoryIfNeeded(options = {}) {
  if (!isAliyunIotConfigured()) {
    await petLocalStore.init()
    return
  }

  const metricKeys = options.metricKeys || []
  const scopeKey = metricKeys.length ? metricKeys.slice().sort().join('|') : 'all'
  const now = Date.now()

  if (!options.force && historySyncPromises.has(scopeKey)) {
    return historySyncPromises.get(scopeKey)
  }

  if (!options.force && now - Number(lastHistorySyncAt.get(scopeKey) || 0) < HISTORY_SYNC_DEDUP_MS) {
    await petLocalStore.init()
    return
  }

  const syncPromise = syncHistoryFromCloud(metricKeys)
    .then(() => {
      lastHistorySyncAt.set(scopeKey, Date.now())
    })
    .finally(() => {
      historySyncPromises.delete(scopeKey)
    })

  historySyncPromises.set(scopeKey, syncPromise)
  return syncPromise
}

async function syncHistoryFromCloud(metricKeys = []) {
  await ensureCloudReady()
  const definitions = getHistoryPropertyDefinitions(metricKeys)
  const tasks = definitions.map((definition) => syncPropertyHistory(definition))
  await Promise.all(tasks)
}

async function syncPropertyHistory(definition) {
  const now = Date.now()
  const syncKey = [
    'history',
    aliyunIotConfig.queryMode,
    aliyunIotConfig.productKey,
    definition.deviceName,
    definition.identifier
  ].join(':')
  const lastSyncedAt = Number(await petLocalStore.getMeta(syncKey))
  const defaultStartTime = now - aliyunIotConfig.historyLookbackMinutes * 60 * 1000
  const startTime = Math.max(defaultStartTime, lastSyncedAt > 0 ? lastSyncedAt + 1 : defaultStartTime)

  if (startTime >= now - 1000) {
    return
  }

  const historyItems = await queryHistoryPages({
    deviceName: definition.deviceName,
    identifier: definition.identifier,
    startTime,
    endTime: now
  })
  const points = historyItems.flatMap((item) =>
    flattenPropertyRecord({
      productKey: aliyunIotConfig.productKey,
      deviceName: definition.deviceName,
      identifier: definition.identifier,
      value: item.Value ?? item.value,
      time: item.Time ?? item.time
    })
  )

  if (points.length) {
    await petLocalStore.upsertMetricPoints(points)
  }

  await petLocalStore.setMeta(syncKey, now)
}

async function queryHistoryPages(options) {
  const items = []
  let nextPageToken = ''
  let cursorStartTime = options.startTime

  for (let pageIndex = 0; pageIndex < aliyunIotConfig.historyMaxPagesPerProperty; pageIndex += 1) {
    const payload = await queryDevicePropertyHistory({
      ...options,
      startTime: cursorStartTime,
      nextPageToken
    })
    items.push(...extractHistoryItems(payload))

    if (aliyunIotConfig.queryMode === 'original') {
      nextPageToken = extractNextPageToken(payload)
      if (!nextPageToken) {
        break
      }
      continue
    }

    const nextTime = Number(payload?.Data?.NextTime ?? payload?.Data?.nextTime)
    const nextValid = Boolean(payload?.Data?.NextValid ?? payload?.Data?.nextValid)
    if (!nextValid || !Number.isFinite(nextTime) || nextTime <= cursorStartTime) {
      break
    }
    cursorStartTime = nextTime + 1
  }

  return items
}

async function ensureCloudReady() {
  await petLocalStore.init()

  if (!isAliyunIotConfigured()) {
    const missingFields = getAliyunIotMissingFields().join(', ')
    throw new Error(`阿里云直连配置不完整，请在 .env.local 中补充：${missingFields}`)
  }
}

async function ensureRealtimeSyncStarted() {
  if (!isAliyunMqttConfigured()) {
    await petLocalStore.init()
    return
  }

  await ensureAliyunMqttStarted()
}

function extractStatusItems(payload) {
  const list = payload?.Data?.List ?? payload?.Data?.list ?? payload?.List ?? payload?.list
  return normalizeAliyunList(list, ['PropertyStatusInfo', 'propertyStatusInfo'])
}

function extractHistoryItems(payload) {
  const list = payload?.Data?.List ?? payload?.Data?.list ?? payload?.List ?? payload?.list
  return normalizeAliyunList(list, ['PropertyInfo', 'propertyInfo', 'PropertyDataInfo', 'propertyDataInfo'])
}

function extractNextPageToken(payload) {
  return (
    payload?.Data?.NextPageToken ||
    payload?.Data?.nextPageToken ||
    payload?.NextPageToken ||
    payload?.nextPageToken ||
    ''
  )
}

function normalizeAliyunList(list, candidateKeys) {
  if (Array.isArray(list)) {
    return list
  }

  if (!list || typeof list !== 'object') {
    return []
  }

  for (const key of candidateKeys) {
    const value = list[key]
    if (Array.isArray(value)) {
      return value
    }
    if (value && typeof value === 'object') {
      return [value]
    }
  }

  return []
}

function buildTelemetry(points, stepCount) {
  const latestPoint = points.reduce((latest, point) => {
    if (!latest || Number(point.ts) > Number(latest.ts)) {
      return point
    }
    return latest
  }, null)
  const lastActiveAt = Number(latestPoint?.ts) || null
  const now = Date.now()
  const onlineWindowMs = aliyunIotConfig.onlineWindowMinutes * 60 * 1000

  return {
    source: {
      deviceName: latestPoint?.device_name || '--',
      requestId: getAliyunMqttState().lastMessageAt ? 'aliyun-mqtt' : 'aliyun-openapi',
      createdAt: lastActiveAt
    },
    sections: createMetricSections(points),
    raw: {
      source: getAliyunMqttState().lastMessageAt ? 'aliyun-mqtt' : 'aliyun-openapi',
      storage: getLocalStorageModeLabel(),
      queryMode: aliyunIotConfig.queryMode,
      mqtt: getAliyunMqttState()
    },
    topic: getAliyunMqttState().lastMessageAt ? aliyunIotConfig.mqtt.topics.join(',') : 'aliyun:iot-openapi',
    receivedAt: now,
    stepCount,
    isOnline: Boolean(lastActiveAt && now - lastActiveAt <= onlineWindowMs),
    lastActiveAt
  }
}

async function calculateTodayStepCount() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const samples = await petLocalStore.getMotionSamplesSince(today.getTime())
  let steps = 0
  let previousMagnitude = null

  for (const sample of samples) {
    const magnitude = Math.sqrt(sample.x ** 2 + sample.y ** 2 + sample.z ** 2)
    if (previousMagnitude !== null && Math.abs(magnitude - previousMagnitude) > 1.2) {
      steps += 1
    }
    previousMagnitude = magnitude
  }

  return steps
}

function resolveEmotionLabel(point) {
  if (!point) {
    return ''
  }

  const displayValue = getDisplayValue(point)
  if (displayValue && displayValue !== '--') {
    return String(displayValue)
  }

  return getEmotionLabel(point.value_num)
}

function getEmotionScore(moodLabel) {
  const scoreMap = {
    开心: 82,
    焦虑: 58,
    孤独: 62,
    难过: 54,
    生气: 48
  }

  return scoreMap[moodLabel] || 65
}

function createEmotionSummary(moodLabel) {
  if (!moodLabel) {
    return []
  }

  return [
    { label: '当前状态', value: moodLabel },
    { label: '数据来源', value: '阿里云 IoT' },
    { label: '本地存储', value: getLocalStorageModeLabel() }
  ]
}
