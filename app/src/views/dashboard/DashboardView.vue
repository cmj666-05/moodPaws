<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ensureVideoStreamUrl, getVideoStreamUrl } from '../../config/api'
import { usePetApi } from '../../composables/usePetApi'

const fallbackHouse = {
  id: 1,
  name: '当前宠舍',
  petName: '宠物状态',
  petProfile: '已连接',
  avatar: '🐤',
  notificationCount: 1,
  environment: {
    temperature: { value: 24, status: '舒适', unit: '°C' },
    humidity: { value: 50, unit: '%' },
    airQuality: { value: '--', unit: '' },
    co2: { value: '--', unit: 'ppm' }
  },
  liveView: {
    hasVideo: true,
    status: '在线看护',
    videoStreamUrl: ''
  },
  appetite: {
    foodIntake: 75,
    waterConsumption: 60
  },
  emotion: {
    primary: '放松',
    secondary: '想玩耍'
  }
}

const {
  loading,
  errorMessage,
  latestTelemetry,
  metricSections,
  emotion,
  refreshTelemetryBundle,
  refreshEmotionBundle,
  startTelemetryPolling,
  startEmotionPolling,
  stopTelemetryPolling,
  stopEmotionPolling
} = usePetApi()

const hasVideoError = ref(false)
const isVideoConnecting = ref(false)
const reconnectAttempt = ref(0)
let deferredVideoDiscoveryTask = null

const allMetrics = computed(() =>
  metricSections.value.flatMap((section) => section.metrics || [])
)

const getMetric = (keys) => computed(() => {
  const keyList = Array.isArray(keys) ? keys : [keys]
  return allMetrics.value.find((metric) => keyList.includes(metric.key))
})

const temperatureMetric = getMetric(['PetHouse:Temp'])
const humidityMetric = getMetric(['PetHouse:Humi'])
const co2Metric = getMetric(['PetHouse:CO2'])
const airQualityMetric = getMetric(['PetHouse:VOC', 'PetHouse:MQ135'])
const resolvedVideoStreamUrl = computed(() => getVideoStreamUrl())

function scheduleDeferredTask(callback, timeout = 240) {
  if (typeof window === 'undefined') {
    return null
  }

  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, { timeout })
  }

  return window.setTimeout(callback, timeout)
}

function clearDeferredTask(taskId) {
  if (taskId == null || typeof window === 'undefined') {
    return
  }

  if (typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(taskId)
    return
  }

  window.clearTimeout(taskId)
}

function formatMetricDisplay(metric, fallback) {
  const value = metric?.value
  const unit = metric?.unit || fallback.unit || ''

  if (value === undefined || value === null || value === '') {
    return {
      value: fallback.value,
      unit
    }
  }

  return {
    value,
    unit
  }
}

const petProfile = computed(() => {
  const sourceDevice = latestTelemetry.value.source?.deviceName
  return sourceDevice && sourceDevice !== '--'
    ? '设备已连接'
    : fallbackHouse.petProfile
})

const selectedHouse = computed(() => ({
  ...fallbackHouse,
  petProfile: petProfile.value,
  liveView: {
    ...fallbackHouse.liveView,
    hasVideo: Boolean(resolvedVideoStreamUrl.value),
    videoStreamUrl: resolvedVideoStreamUrl.value
  },
  environment: {
    temperature: {
      value: Number(temperatureMetric.value?.value) || fallbackHouse.environment.temperature.value,
      status: temperatureMetric.value ? '实时同步' : fallbackHouse.environment.temperature.status,
      unit: temperatureMetric.value?.unit || fallbackHouse.environment.temperature.unit
    },
    humidity: {
      value: Number(humidityMetric.value?.value) || fallbackHouse.environment.humidity.value,
      unit: humidityMetric.value?.unit || fallbackHouse.environment.humidity.unit
    },
    airQuality: formatMetricDisplay(airQualityMetric.value, fallbackHouse.environment.airQuality),
    co2: formatMetricDisplay(co2Metric.value, fallbackHouse.environment.co2)
  },
  emotion: {
    primary: emotion.value?.currentMood || fallbackHouse.emotion.primary,
    secondary: errorMessage.value
      ? '等待恢复'
      : loading.value
        ? '同步中'
        : fallbackHouse.emotion.secondary
  }
}))

const streamSrc = computed(() => {
  const url = selectedHouse.value.liveView.videoStreamUrl
  if (!url) return ''
  return reconnectAttempt.value === 0
    ? url
    : `${url}${url.includes('?') ? '&' : '?'}t=${reconnectAttempt.value}`
})

const liveViewStatus = computed(() => {
  if (!selectedHouse.value.liveView.hasVideo) {
    if (isVideoConnecting.value) return '搜索中'
    return loading.value ? '发现视频中' : '无视频源'
  }

  if (isVideoConnecting.value) return '连接中'
  if (hasVideoError.value) return '监控离线'
  return selectedHouse.value.liveView.status
})

function handleStreamLoad() {
  isVideoConnecting.value = false
  hasVideoError.value = false
}

function handleStreamError() {
  isVideoConnecting.value = false
  hasVideoError.value = true
}

async function reconnectStream() {
  hasVideoError.value = false
  isVideoConnecting.value = true
  await ensureVideoStreamUrl({
    forceDiscovery: true,
    reason: 'dashboard_manual_reconnect'
  })
  reconnectAttempt.value += 1
}

function scheduleVideoDiscovery() {
  clearDeferredTask(deferredVideoDiscoveryTask)
  deferredVideoDiscoveryTask = scheduleDeferredTask(async () => {
    deferredVideoDiscoveryTask = null

    try {
      await ensureVideoStreamUrl({ reason: 'dashboard_mount' })
    } catch {
      // Video discovery should not block the first paint of the dashboard.
    }
  }, 500)
}

watch(
  resolvedVideoStreamUrl,
  (url, previousUrl) => {
    if (!url) {
      hasVideoError.value = false
      isVideoConnecting.value = false
      reconnectAttempt.value = 0
      return
    }

    if (url !== previousUrl) {
      hasVideoError.value = false
      isVideoConnecting.value = true
      reconnectAttempt.value = 0
    }
  },
  { immediate: true }
)

onMounted(async () => {
  await Promise.all([
    refreshTelemetryBundle({ includeHistory: false, includeTrack: false }),
    refreshEmotionBundle()
  ])
  startTelemetryPolling()
  startEmotionPolling()
  scheduleVideoDiscovery()
})

onBeforeUnmount(() => {
  stopTelemetryPolling()
  stopEmotionPolling()
  clearDeferredTask(deferredVideoDiscoveryTask)
})
</script>

<template>
  <div class="pet-house-view">
    <section class="boarding-card">
      <div class="card-header">
        <div class="header-copy">
          <h1 class="page-title">宠舍照护总览</h1>
        </div>

        <div class="header-top">
          <div class="dog-avatar-container">
            <div class="dog-avatar">{{ selectedHouse.avatar }}</div>
          </div>
          <div class="boarding-info">
            <div class="house-name">{{ selectedHouse.name }}</div>
            <div class="buddy-info">
              <span class="status-dot"></span>{{ selectedHouse.petName }} · {{ selectedHouse.petProfile }}
            </div>
          </div>
          <div class="notification-bell" aria-label="照护提醒">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span v-if="selectedHouse.notificationCount" class="badge">{{ selectedHouse.notificationCount }}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h3 class="section-title">环境监测</h3>
        <div class="env-grid">
          <div class="env-card temperature">
            <div class="env-icon env-icon-temperature" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 4a2 2 0 0 0-2 2v7.2a4 4 0 1 0 4 0V6a2 2 0 0 0-2-2Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M12 10v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </div>
            <div class="env-label">温度</div>
            <div class="env-value">
              <span>{{ selectedHouse.environment.temperature.value }}</span>
              <span class="env-unit">{{ selectedHouse.environment.temperature.unit }}</span>
            </div>
          </div>

          <div class="env-card humidity">
            <div class="env-icon env-icon-humidity" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3.5s-5 6.1-5 10a5 5 0 0 0 10 0c0-3.9-5-10-5-10Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
              </svg>
            </div>
            <div class="env-label">湿度</div>
            <div class="env-value">
              <span>{{ selectedHouse.environment.humidity.value }}</span>
              <span class="env-unit">{{ selectedHouse.environment.humidity.unit }}</span>
            </div>
          </div>

          <div class="env-card air-quality air-quality-combined">
            <div class="env-metric-group">
              <div class="env-label">空气质量</div>
              <div class="env-value">
                <span>{{ selectedHouse.environment.airQuality.value }}</span>
                <span v-if="selectedHouse.environment.airQuality.unit" class="env-unit">{{ selectedHouse.environment.airQuality.unit }}</span>
              </div>
            </div>
            <div class="env-metric-group env-metric-group-secondary">
              <div class="env-sub-label">二氧化碳浓度</div>
              <div class="env-value env-value-secondary">
                <span>{{ selectedHouse.environment.co2.value }}</span>
                <span v-if="selectedHouse.environment.co2.unit" class="env-unit">{{ selectedHouse.environment.co2.unit }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <h3 class="section-title">实时看护</h3>
        <div class="live-view">
          <div class="video-placeholder">
            <img
              v-if="selectedHouse.liveView.hasVideo && !hasVideoError"
              :key="streamSrc"
              :src="streamSrc"
              alt="宠舍监控画面"
              class="video-stream"
              :class="{ connecting: isVideoConnecting }"
              @load="handleStreamLoad"
              @error="handleStreamError"
            />
            <div v-if="isVideoConnecting" class="video-overlay connecting">
              <span class="video-spinner" aria-hidden="true"></span>
              <span class="video-overlay-text">正在连接监控画面...</span>
            </div>
            <div v-else-if="!selectedHouse.liveView.hasVideo || hasVideoError" class="video-overlay offline">
              <span class="video-icon">📴</span>
              <span class="video-overlay-text">
                {{ selectedHouse.liveView.hasVideo ? '监控已离线或无法连接' : '等待发现局域网视频源' }}
              </span>
              <button
                type="button"
                class="reconnect-button"
                @click="reconnectStream"
              >
                {{ selectedHouse.liveView.hasVideo ? '重新连接' : '重新搜索' }}
              </button>
            </div>
            <span class="video-badge" :class="{ offline: hasVideoError, connecting: isVideoConnecting }">{{ liveViewStatus }}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h3 class="section-title">饮食与饮水</h3>
        <div class="appetite-section">
          <div class="appetite-item">
            <div class="appetite-label">食物摄入</div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${selectedHouse.appetite.foodIntake}%` }"></div>
            </div>
          </div>
          <div class="appetite-item">
            <div class="appetite-label">饮水进度</div>
            <div class="progress-bar">
              <div class="progress-fill water" :style="{ width: `${selectedHouse.appetite.waterConsumption}%` }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <h3 class="section-title">情绪反馈</h3>
        <div class="emotion-badges">
          <div class="emotion-badge happy">{{ selectedHouse.emotion.primary }}</div>
          <div class="emotion-badge playful">{{ selectedHouse.emotion.secondary }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped src="./DashboardView.css"></style>
