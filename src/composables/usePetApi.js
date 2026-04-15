import { computed, ref } from 'vue'
import { buildApiUrl, apiConfig } from '../config/api'

const loading = ref(false)
const telemetryLoading = ref(false)
const emotionLoading = ref(false)
const errorMessage = ref('')
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
const emotion = ref({
  source: 'mock',
  currentMood: '开心',
  score: 68,
  voice: { frequency: [], tone: [] },
  fluctuation: { timeline: [], values: [] },
  history: [],
  createdAt: null
})

let telemetryPollTimer = null
let emotionPollTimer = null
let telemetryRefreshPromise = null
let emotionRefreshPromise = null
let lastTelemetryRefreshAt = 0
let lastEmotionRefreshAt = 0
const REFRESH_DEDUP_MS = 3000

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
  const rawPayloadText = computed(() =>
    latestTelemetry.value.raw ? JSON.stringify(latestTelemetry.value.raw, null, 2) : ''
  )

  const statusText = computed(() => {
    if (loading.value) return 'Loading'
    if (errorMessage.value) return 'Error'
    return latestTelemetry.value.sections?.length ? 'Ready' : 'Waiting for data'
  })

  async function fetchJson(path) {
    const response = await fetch(buildApiUrl(path))
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`)
    }
    return response.json()
  }

  function syncLoadingState() {
    loading.value = telemetryLoading.value || emotionLoading.value
  }

  async function refreshTelemetry() {
    const data = await fetchJson('/telemetry/latest')
    if (data && typeof data === 'object') {
      latestTelemetry.value = {
        source: data.source || latestTelemetry.value.source,
        sections: data.sections || latestTelemetry.value.sections,
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
        source: data.source || emotion.value.source,
        currentMood: data.currentMood || emotion.value.currentMood,
        score: data.score ?? emotion.value.score,
        voice: data.voice || emotion.value.voice,
        fluctuation: data.fluctuation || emotion.value.fluctuation,
        history: data.history || emotion.value.history,
        createdAt: data.createdAt || emotion.value.createdAt
      }
    }
  }

  async function refreshTelemetryBundle(options = {}) {
    const force = options.force === true
    const now = Date.now()

    if (!force && telemetryRefreshPromise) {
      return telemetryRefreshPromise
    }

    if (!force && now - lastTelemetryRefreshAt < REFRESH_DEDUP_MS) {
      return
    }

    telemetryLoading.value = true
    syncLoadingState()
    telemetryRefreshPromise = Promise.all([
      refreshTelemetry(),
      refreshHeartRateHistory(),
      refreshLocationTrack()
    ])
      .then(() => {
        errorMessage.value = ''
        lastTelemetryRefreshAt = Date.now()
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
  }

  function startTelemetryPolling() {
    if (telemetryPollTimer) {
      return
    }

    telemetryPollTimer = window.setInterval(() => {
      refreshTelemetryBundle({ force: true })
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
    rawPayloadText,
    statusText,
    refreshAll,
    refreshTelemetry,
    refreshHeartRateHistory,
    refreshLocationTrack,
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

function formatTime(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return '--'
  return new Date(parsed).toLocaleString('zh-CN', { hour12: false })
}
