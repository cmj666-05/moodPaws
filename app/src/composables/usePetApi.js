import { computed, ref } from 'vue'
import { apiConfig } from '../config/api'
import {
  loadHeartRateHistory,
  loadLatestEmotion,
  loadLatestTelemetry,
  loadLocationTrack
} from '../services/pet/pet-data-service'

const loading = ref(false)
const telemetryLoading = ref(false)
const emotionLoading = ref(false)
const errorMessage = ref('')

function createEmptyEmotionState() {
  return {
    source: '',
    currentMood: '',
    score: null,
    voice: { frequency: [], tone: [] },
    fluctuation: { timeline: [], values: [] },
    history: [],
    createdAt: null
  }
}

const latestTelemetry = ref({
  source: { deviceName: '--', requestId: '--', createdAt: null },
  sections: [],
  raw: null,
  topic: '--',
  receivedAt: null,
  stepCount: 0,
  isOnline: false,
  lastActiveAt: null
})
const heartRateHistory = ref([])
const locationTrack = ref([])
const emotion = ref(createEmptyEmotionState())

let telemetryPollTimer = null
let emotionPollTimer = null
let telemetryRefreshPromise = null
let emotionRefreshPromise = null
let lastTelemetryRefreshAt = 0
let lastEmotionRefreshAt = 0
let lastTelemetryDetailsRefreshAt = 0
const REFRESH_DEDUP_MS = 3000
const MAX_TRACK_POINTS = 48
const DETAILS_REFRESH_INTERVAL_MS = Number(
  import.meta.env.VITE_API_DETAILS_POLL_INTERVAL || Math.max(apiConfig.pollInterval * 6, 30000)
)

export function usePetApi() {
  const sourceSummary = computed(() => [
    { label: 'Topic', value: latestTelemetry.value.topic || '--' },
    { label: 'Last Source Device', value: latestTelemetry.value.source?.deviceName || '--' },
    { label: 'Request ID', value: latestTelemetry.value.source?.requestId || '--' },
    {
      label: 'Created At',
      value: formatTime(latestTelemetry.value.source?.createdAt)
    }
  ])

  const metricSections = computed(() => latestTelemetry.value.sections || [])
  const metricMap = computed(() => createMetricMap(metricSections.value))
  const homeMetrics = computed(() => ({
    emotionState: metricMap.value.EmotionState,
    collarTemp: metricMap.value['Collar:temp'],
    heartRate: metricMap.value['Collar:MAX30102.HeartRate'],
    spo2: metricMap.value['Collar:MAX30102.SPO2'],
    weight: metricMap.value['Collar:Weight'],
    longitude: metricMap.value['Collar:GPS.Longitude'],
    latitude: metricMap.value['Collar:GPS.Latitude'],
    motionX: metricMap.value['Collar:BNO085.X'],
    motionY: metricMap.value['Collar:BNO085.Y'],
    motionZ: metricMap.value['Collar:BNO085.Z']
  }))
  const rawPayloadText = computed(() =>
    latestTelemetry.value.raw ? JSON.stringify(latestTelemetry.value.raw, null, 2) : ''
  )

  const statusText = computed(() => {
    if (loading.value) return 'Loading'
    if (errorMessage.value) return 'Error'
    return latestTelemetry.value.sections?.length ? 'Ready' : 'Waiting for data'
  })

  function syncLoadingState() {
    loading.value = telemetryLoading.value || emotionLoading.value
  }

  async function refreshTelemetry(options = {}) {
    const data = await loadLatestTelemetry({ force: options.force === true })
    if (data && typeof data === 'object') {
      latestTelemetry.value = {
        source: data.source || latestTelemetry.value.source,
        sections: mergeMetricSections(latestTelemetry.value.sections, data.sections),
        raw: data.raw ?? latestTelemetry.value.raw,
        topic: data.topic || latestTelemetry.value.topic,
        receivedAt: data.receivedAt || latestTelemetry.value.receivedAt,
        stepCount: data.stepCount ?? latestTelemetry.value.stepCount,
        isOnline: data.isOnline ?? latestTelemetry.value.isOnline,
        lastActiveAt: data.lastActiveAt ?? latestTelemetry.value.lastActiveAt
      }
      appendLatestHeartRatePoint(data)
      appendLatestLocationPoint(data)
    }
  }

  async function refreshHeartRateHistory(options = {}) {
    const payload = await loadHeartRateHistory({ limit: 30, force: options.force === true })
    heartRateHistory.value = payload.points || []
  }

  async function refreshLocationTrack(options = {}) {
    const payload = await loadLocationTrack({ limit: MAX_TRACK_POINTS, force: options.force === true })
    locationTrack.value = payload.points || []
  }

  async function refreshEmotion(options = {}) {
    const data = await loadLatestEmotion({ force: options.force === true })
    if (data && typeof data === 'object') {
      emotion.value = {
        source: typeof data.source === 'string' ? data.source : '',
        currentMood: typeof data.currentMood === 'string' ? data.currentMood : '',
        score: Number.isFinite(Number(data.score)) ? Number(data.score) : null,
        voice: {
          frequency: Array.isArray(data.voice?.frequency) ? data.voice.frequency : [],
          tone: Array.isArray(data.voice?.tone) ? data.voice.tone : []
        },
        fluctuation: {
          timeline: Array.isArray(data.fluctuation?.timeline) ? data.fluctuation.timeline : [],
          values: Array.isArray(data.fluctuation?.values) ? data.fluctuation.values : []
        },
        history: Array.isArray(data.history) ? data.history : [],
        createdAt: Number.isFinite(Number(data.createdAt)) ? Number(data.createdAt) : null
      }
      return
    }

    emotion.value = createEmptyEmotionState()
  }

  async function refreshTelemetryBundle(options = {}) {
    const force = options.force === true
    const includeHistory = options.includeHistory !== false
    const includeTrack = options.includeTrack !== false
    const now = Date.now()

    if (!force && telemetryRefreshPromise) {
      return telemetryRefreshPromise
    }

    if (!force && now - lastTelemetryRefreshAt < REFRESH_DEDUP_MS) {
      return
    }

    telemetryLoading.value = true
    syncLoadingState()

    const tasks = [refreshTelemetry({ force })]

    if (includeHistory) {
      tasks.push(refreshHeartRateHistory({ force }))
    }

    if (includeTrack) {
      tasks.push(refreshLocationTrack({ force }))
    }

    telemetryRefreshPromise = Promise.all(tasks)
      .then(() => {
        errorMessage.value = ''
        lastTelemetryRefreshAt = Date.now()
        if (includeHistory || includeTrack) {
          lastTelemetryDetailsRefreshAt = lastTelemetryRefreshAt
        }
      })
      .catch((error) => {
        errorMessage.value = error instanceof Error ? error.message : '加载失败'
      })
      .finally(() => {
        telemetryLoading.value = false
        telemetryRefreshPromise = null
        syncLoadingState()
      })

    return telemetryRefreshPromise
  }

  async function refreshTelemetryDetails(options = {}) {
    const includeHistory = options.includeHistory !== false
    const includeTrack = options.includeTrack !== false
    const tasks = []

    if (includeHistory) {
      tasks.push(refreshHeartRateHistory({ force: options.force === true }))
    }

    if (includeTrack) {
      tasks.push(refreshLocationTrack({ force: options.force === true }))
    }

    if (!tasks.length) {
      return
    }

    await Promise.all(tasks)
    lastTelemetryDetailsRefreshAt = Date.now()
  }

  async function refreshEmotionBundle(options = {}) {
    const force = options.force === true
    const now = Date.now()

    if (!force && emotionRefreshPromise) {
      return emotionRefreshPromise
    }

    if (!force && now - lastEmotionRefreshAt < REFRESH_DEDUP_MS) {
      return
    }

    emotionLoading.value = true
    syncLoadingState()
    emotionRefreshPromise = refreshEmotion({ force })
      .then(() => {
        errorMessage.value = ''
        lastEmotionRefreshAt = Date.now()
      })
      .catch((error) => {
        errorMessage.value = error instanceof Error ? error.message : '加载失败'
      })
      .finally(() => {
        emotionLoading.value = false
        emotionRefreshPromise = null
        syncLoadingState()
      })

    return emotionRefreshPromise
  }

  async function refreshAll(options = {}) {
    return Promise.all([
      refreshTelemetryBundle(options),
      refreshEmotionBundle(options)
    ])
  }

  function clearTelemetry() {
    latestTelemetry.value = {
      source: { deviceName: '--', requestId: '--', createdAt: null },
      sections: [],
      raw: null,
      topic: '--',
      receivedAt: null,
      stepCount: 0,
      isOnline: false,
      lastActiveAt: null
    }
    heartRateHistory.value = []
    locationTrack.value = []
    errorMessage.value = ''
    lastTelemetryDetailsRefreshAt = 0
  }

  function startTelemetryPolling() {
    if (telemetryPollTimer) {
      return
    }

    telemetryPollTimer = window.setInterval(() => {
      const shouldRefreshDetails =
        Date.now() - lastTelemetryDetailsRefreshAt >= DETAILS_REFRESH_INTERVAL_MS

      refreshTelemetryBundle({
        force: true,
        includeHistory: shouldRefreshDetails,
        includeTrack: shouldRefreshDetails
      })
    }, apiConfig.pollInterval)
  }

  function stopTelemetryPolling() {
    if (telemetryPollTimer) {
      window.clearInterval(telemetryPollTimer)
      telemetryPollTimer = null
    }
  }

  function startEmotionPolling() {
    if (emotionPollTimer) {
      return
    }

    emotionPollTimer = window.setInterval(() => {
      refreshEmotionBundle({ force: true })
    }, apiConfig.pollInterval)
  }

  function stopEmotionPolling() {
    if (emotionPollTimer) {
      window.clearInterval(emotionPollTimer)
      emotionPollTimer = null
    }
  }

  function startPolling() {
    startTelemetryPolling()
    startEmotionPolling()
  }

  function stopPolling() {
    stopTelemetryPolling()
    stopEmotionPolling()
  }


  return {
    loading,
    telemetryLoading,
    emotionLoading,
    errorMessage,
    latestTelemetry,
    heartRateHistory,
    locationTrack,
    emotion,
    sourceSummary,
    metricSections,
    metricMap,
    homeMetrics,
    rawPayloadText,
    statusText,
    refreshAll,
    refreshTelemetry,
    refreshHeartRateHistory,
    refreshLocationTrack,
    refreshTelemetryDetails,
    refreshEmotion,
    refreshTelemetryBundle,
    refreshEmotionBundle,
    clearTelemetry,
    startPolling,
    stopPolling,
    startTelemetryPolling,
    stopTelemetryPolling,
    startEmotionPolling,
    stopEmotionPolling
  }
}

function createMetricMap(sections = []) {
  return sections
    .flatMap((section) => section.metrics || [])
    .reduce((result, metric) => {
      result[metric.key] = metric
      return result
    }, {})
}

function mergeMetricSections(previousSections = [], nextSections = []) {
  if (!Array.isArray(nextSections) || nextSections.length === 0) {
    return previousSections || []
  }

  const previousMetrics = createMetricMap(previousSections)

  return nextSections.map((section) => ({
    ...section,
    metrics: (section.metrics || []).map((metric) => {
      const hasValue = metric?.value !== undefined && metric?.value !== null && metric?.value !== '--'
      return hasValue
        ? metric
        : previousMetrics[metric.key]
          ? { ...metric, value: previousMetrics[metric.key].value, time: previousMetrics[metric.key].time }
          : metric
    })
  }))
}

function appendLatestHeartRatePoint(telemetry) {
  const metricMap = createMetricMap(telemetry?.sections || [])
  const heartRateMetric = metricMap['Collar:MAX30102.HeartRate']
  const value = Number(heartRateMetric?.value)

  if (!Number.isFinite(value)) {
    return
  }

  const time = Number(heartRateMetric?.time || telemetry?.receivedAt || Date.now())
  const history = heartRateHistory.value || []
  const lastPoint = history[history.length - 1]

  if (lastPoint && Number(lastPoint.time) >= time) {
    return
  }

  heartRateHistory.value = [
    ...history,
    {
      value,
      time
    }
  ].slice(-30)
}

function appendLatestLocationPoint(telemetry) {
  const metricMap = createMetricMap(telemetry?.sections || [])
  const longitudeMetric = metricMap['Collar:GPS.Longitude']
  const latitudeMetric = metricMap['Collar:GPS.Latitude']
  const accuracyMetric = metricMap['Collar:GPS.Accuracy']
  const longitude = Number(longitudeMetric?.value)
  const latitude = Number(latitudeMetric?.value)

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return
  }

  const accuracy = Number(accuracyMetric?.value ?? telemetry?.raw?.gps?.accuracy)
  const speed = Number(telemetry?.raw?.gps?.speed)
  const time = Number(
    longitudeMetric?.time ||
      latitudeMetric?.time ||
      accuracyMetric?.time ||
      telemetry?.receivedAt ||
      Date.now()
  )
  const history = locationTrack.value || []
  const nextPoint = {
    longitude,
    latitude,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    speed: Number.isFinite(speed) ? speed : null,
    time
  }
  const lastPoint = history[history.length - 1]

  if (lastPoint && Number(lastPoint.time) > time) {
    return
  }

  if (lastPoint && isSameCoordinatePoint(lastPoint, nextPoint)) {
    locationTrack.value = [...history.slice(0, -1), { ...lastPoint, ...nextPoint }]
    return
  }

  locationTrack.value = [...history, nextPoint].slice(-MAX_TRACK_POINTS)
}

function isSameCoordinatePoint(firstPoint, secondPoint) {
  const tolerance = 0.000002

  return (
    Math.abs(Number(firstPoint?.longitude) - Number(secondPoint?.longitude)) <= tolerance &&
    Math.abs(Number(firstPoint?.latitude) - Number(secondPoint?.latitude)) <= tolerance
  )
}

function formatTime(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return '--'
  return new Date(parsed).toLocaleString('zh-CN', { hour12: false })
}
