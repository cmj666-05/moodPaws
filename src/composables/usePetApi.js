import { computed, onBeforeUnmount, ref } from 'vue'
import { buildApiUrl, apiConfig } from '../config/api'

export function usePetApi() {
  const loading = ref(false)
  const errorMessage = ref('')
  const latestTelemetry = ref({
    source: { deviceName: '--', requestId: '--', createdAt: null },
    sections: [],
    raw: null,
    topic: '--',
    receivedAt: null
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

  let pollTimer = null

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

  async function refreshTelemetry() {
    latestTelemetry.value = await fetchJson('/telemetry/latest')
  }

  async function refreshHeartRateHistory() {
    const payload = await fetchJson('/telemetry/metrics/HeartRate/history?limit=30')
    heartRateHistory.value = payload.points || []
  }

  async function refreshLocationTrack() {
    const payload = await fetchJson('/telemetry/location/track?limit=200')
    locationTrack.value = payload.points || []
  }

  async function refreshEmotion() {
    emotion.value = await fetchJson('/emotion/latest')
  }

  async function refreshAll() {
    loading.value = true
    try {
      await Promise.all([
        refreshTelemetry(),
        refreshHeartRateHistory(),
        refreshLocationTrack(),
        refreshEmotion()
      ])
      errorMessage.value = ''
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '加载失败'
    } finally {
      loading.value = false
    }
  }

  function clearTelemetry() {
    latestTelemetry.value = {
      source: { deviceName: '--', requestId: '--', createdAt: null },
      sections: [],
      raw: null,
      topic: '--',
      receivedAt: null
    }
    heartRateHistory.value = []
    locationTrack.value = []
    errorMessage.value = ''
  }

  function startPolling() {
    stopPolling()
    pollTimer = window.setInterval(() => {
      refreshAll()
    }, apiConfig.pollInterval)
  }

  function stopPolling() {
    if (pollTimer) {
      window.clearInterval(pollTimer)
      pollTimer = null
    }
  }

  onBeforeUnmount(() => {
    stopPolling()
  })

  return {
    loading,
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
    clearTelemetry,
    startPolling,
    stopPolling
  }
}

function formatTime(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return '--'
  return new Date(parsed).toLocaleString('zh-CN', { hour12: false })
}
