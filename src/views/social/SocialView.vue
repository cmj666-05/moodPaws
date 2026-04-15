<script setup>
import { computed, onMounted, ref } from 'vue'
import { usePetApi } from '../../composables/usePetApi'

const fallbackHouse = {
  id: 1,
  name: '阳光宠舍 A01',
  petName: 'Buddy',
  petProfile: '金毛寻回犬 · 3 岁',
  avatar: '🐕',
  notificationCount: 1,
  environment: {
    temperature: { value: 24, status: '舒适', unit: '°C' },
    humidity: { value: 50, unit: '%' },
    airQuality: '良好'
  },
  liveView: {
    hasVideo: true,
    status: '在线看护',
    videoStreamUrl: 'http://192.168.1.100:5000/video_feed'
  },
  vitalSigns: {
    heartRate: { value: 78, unit: 'BPM', status: '稳定' },
    weight: { value: 28.6, unit: 'kg', status: '平稳' }
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
  refreshAll,
  refreshTelemetryBundle,
  refreshEmotionBundle,
  startTelemetryPolling,
  startEmotionPolling
} = usePetApi()

const hasVideoError = ref(false)
const isVideoConnecting = ref(true)
const reconnectAttempt = ref(0)

const allMetrics = computed(() =>
  metricSections.value.flatMap((section) => section.metrics || [])
)

const getMetric = (keys) => computed(() => {
  const keyList = Array.isArray(keys) ? keys : [keys]
  return allMetrics.value.find((metric) => keyList.includes(metric.key))
})

const temperatureMetric = getMetric(['PetHouse:Temp'])
const humidityMetric = getMetric(['PetHouse:Humi'])
const heartRateMetric = getMetric(['HeartRate', 'Collar:XKXY:HeartRate'])
const weightMetric = getMetric(['PetHouse:Weight', 'Weight'])
const airMetric = getMetric(['PetHouse:CO2', 'PetHouse:VOC', 'PetHouse:MQ135'])

const airQualityLabel = computed(() => {
  const value = Number(airMetric.value?.value)
  if (!Number.isFinite(value)) return fallbackHouse.environment.airQuality
  if (value <= 800) return '良好'
  if (value <= 1500) return '一般'
  return '需关注'
})

const petProfile = computed(() => {
  const sourceDevice = latestTelemetry.value.source?.deviceName
  return sourceDevice && sourceDevice !== '--'
    ? `金毛寻回犬 · 3 岁 · 来源 ${sourceDevice}`
    : fallbackHouse.petProfile
})

const selectedHouse = computed(() => ({
  ...fallbackHouse,
  petProfile: petProfile.value,
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
    airQuality: airQualityLabel.value
  },
  vitalSigns: {
    heartRate: {
      value: Number(heartRateMetric.value?.value) || fallbackHouse.vitalSigns.heartRate.value,
      unit: heartRateMetric.value?.unit || fallbackHouse.vitalSigns.heartRate.unit,
      status: heartRateMetric.value ? '实时同步' : fallbackHouse.vitalSigns.heartRate.status
    },
    weight: {
      value: Number(weightMetric.value?.value) || fallbackHouse.vitalSigns.weight.value,
      unit: weightMetric.value?.unit || fallbackHouse.vitalSigns.weight.unit,
      status: weightMetric.value ? '实时同步' : fallbackHouse.vitalSigns.weight.status
    }
  },
  emotion: {
    primary: emotion.value?.currentMood || fallbackHouse.emotion.primary,
    secondary: errorMessage.value ? '等待恢复' : loading.value ? '同步中' : fallbackHouse.emotion.secondary
  }
}))

const syncText = computed(() => {
  if (loading.value) return '宠舍数据同步中'
  if (errorMessage.value) return `宠舍数据加载失败：${errorMessage.value}`
  return latestTelemetry.value.receivedAt ? '宠舍数据已连接后端接口' : '当前展示本地照护占位数据'
})

const streamSrc = computed(() => {
  const url = selectedHouse.value.liveView.videoStreamUrl
  return reconnectAttempt.value === 0 ? url : `${url}${url.includes('?') ? '&' : '?'}t=${reconnectAttempt.value}`
})

const liveViewStatus = computed(() => {
  if (isVideoConnecting.value) return '连接中'
  if (hasVideoError.value) return '监控离线'
  return selectedHouse.value.liveView.status
})

const handleStreamLoad = () => {
  isVideoConnecting.value = false
  hasVideoError.value = false
}

const handleStreamError = () => {
  isVideoConnecting.value = false
  hasVideoError.value = true
}

const reconnectStream = () => {
  hasVideoError.value = false
  isVideoConnecting.value = true
  reconnectAttempt.value += 1
}

onMounted(async () => {
  await Promise.all([refreshTelemetryBundle(), refreshEmotionBundle()])
  startTelemetryPolling()
  startEmotionPolling()
})
</script>

<template>
  <div class="pet-house-view">
    <section class="boarding-card">
      <div class="card-header">
        <div class="header-copy">
          <p class="page-kicker">Pet House</p>
          <h1 class="page-title">宠舍照护总览</h1>
          <p class="page-subtitle">当前为宠舍业务页首版，展示环境、看护、体征与照护状态。</p>
          <p class="sync-hint">{{ syncText }}</p>
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
            <div class="env-label">温度</div>
            <div class="env-value">{{ selectedHouse.environment.temperature.value }}{{ selectedHouse.environment.temperature.unit }}</div>
            <div class="env-status">{{ selectedHouse.environment.temperature.status }}</div>
            <div class="env-slider">
              <span class="slider-btn minus">−</span>
              <div class="slider-bar"></div>
              <span class="slider-btn plus">+</span>
            </div>
          </div>

          <div class="env-card humidity">
            <div class="env-label">湿度</div>
            <div class="env-value">{{ selectedHouse.environment.humidity.value }}{{ selectedHouse.environment.humidity.unit }}</div>
            <div class="env-slider">
              <div class="slider-bar"></div>
            </div>
          </div>

          <div class="env-card air-quality">
            <div class="env-label">空气质量</div>
            <div class="env-value">{{ selectedHouse.environment.airQuality }}</div>
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
              <span class="video-icon">📹</span>
              <span class="video-overlay-text">监控已离线或无法连接</span>
              <button type="button" class="reconnect-button" @click="reconnectStream">重新连接</button>
            </div>
            <span class="video-badge" :class="{ offline: hasVideoError, connecting: isVideoConnecting }">{{ liveViewStatus }}</span>
          </div>
        </div>
      </div>

      <div class="vital-section">
        <h3 class="section-title">生命体征概览</h3>
        <div class="vital-grid">
          <div class="vital-card heart-rate">
            <div class="vital-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12h18M3 12l3-3m0 6l-3-3m18 0l-3 3m0-6l3 3" />
              </svg>
            </div>
            <div class="vital-info">
              <div class="vital-label">心率</div>
              <div class="vital-value">{{ selectedHouse.vitalSigns.heartRate.value }} <span class="vital-unit">{{ selectedHouse.vitalSigns.heartRate.unit }}</span></div>
              <div class="vital-status">{{ selectedHouse.vitalSigns.heartRate.status }}</div>
            </div>
          </div>

          <div class="vital-card calories">
            <div class="vital-icon">⚖️</div>
            <div class="vital-info">
              <div class="vital-label">体重</div>
              <div class="vital-value">{{ selectedHouse.vitalSigns.weight.value }} <span class="vital-unit">{{ selectedHouse.vitalSigns.weight.unit }}</span></div>
              <div class="vital-status">{{ selectedHouse.vitalSigns.weight.status }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <h3 class="section-title">饮食与饮水</h3>
        <div class="appetite-section">
          <div class="appetite-item">
            <div class="appetite-label">食物摄入</div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: selectedHouse.appetite.foodIntake + '%' }"></div>
            </div>
          </div>
          <div class="appetite-item">
            <div class="appetite-label">饮水进度</div>
            <div class="progress-bar">
              <div class="progress-fill water" :style="{ width: selectedHouse.appetite.waterConsumption + '%' }"></div>
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

<style scoped src="./SocialView.css"></style>
