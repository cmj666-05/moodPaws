import { computed, ref } from 'vue'
import { apiConfig, fetchApiJson } from '../config/api'

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
    heartRate: metricMap.value.HeartRate,
    spo2: metricMap.value.SPO2,
    weight: metricMap.value['PetHouse:Weight'],
    longitude: metricMap.value.Longitude,
    latitude: metricMap.value.Latitude,
    motionX: metricMap.value.X,
    motionY: metricMap.value.Y,
    motionZ: metricMap.value.Z
  }))
  const rawPayloadText = computed(() =>
    latestTelemetry.value.raw ? JSON.stringify(latestTelemetry.value.raw, null, 2) : ''
  )

  const statusText = computed(() => {
    if (loading.value) return 'Loading'
    if (errorMessage.value) return 'Error'
    return latestTelemetry.value.sections?.length ? 'Ready' : 'Waiting for data'
  })

  async function fetchJson(path) {
    return fetchApiJson(path)
  }

  function syncLoadingState() {
    loading.value = telemetryLoading.value || emotionLoading.value
  }

  async function refreshTelemetry() {
    const data = await fetchJson('/telemetry/latest')
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
    }
  }

  async function refreshHeartRateHistory() {
    const payload = await fetchJson('/telemetry/metrics/HeartRate/history?limit=30')
    heartRateHistory.value = payload.points || []
  }

  async function refreshLocationTrack() {
    const payload = await fetchJson('/telemetry/location/track?limit=1440')
    locationTrack.value = payload.points || []
  }

  async function refreshEmotion() {
    const data = await fetchJson('/emotion/latest')
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

    const tasks = [refreshTelemetry()]

    if (includeHistory) {
      tasks.push(refreshHeartRateHistory())
    }

    if (includeTrack) {
      tasks.push(refreshLocationTrack())
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
      tasks.push(refreshHeartRateHistory())
    }

    if (includeTrack) {
      tasks.push(refreshLocationTrack())
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
    emotionRefreshPromise = refreshEmotion()
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

function formatTime(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return '--'
  return new Date(parsed).toLocaleString('zh-CN', { hour12: false })
}
