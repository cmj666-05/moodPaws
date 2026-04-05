<script setup>
import { Capacitor } from '@capacitor/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { amapConfig } from '../../config/amap'
import { usePetApi } from '../../composables/usePetApi'
import { loadAmap } from '../../services/amap/loader'

const formatMetricTime = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return new Date().toLocaleTimeString()
  return new Date(parsed).toLocaleTimeString()
}

const formatHistoryPoints = (points) =>
  points.map((item) => ({
    v: Number(item.value),
    t: formatMetricTime(item.time)
  }))

const getLastHeartRate = (points) => points.at(-1)?.v ?? '--'

echarts.use([LineChart, GridComponent, CanvasRenderer])

const {
  loading,
  errorMessage,
  metricSections,
  heartRateHistory,
  locationTrack,
  emotion,
  refreshAll,
  startPolling,
  stopPolling
} = usePetApi()

const mapContainer = ref(null)
const mapError = ref('')

let map = null
let marker = null
let polyline = null

function getMetric(sectionKey, metricKey) {
  const section = metricSections.value?.find((item) => item.key === sectionKey)
  return section?.metrics?.find((item) => item.key === metricKey)
}

const heartRate = computed(() => getMetric('collar-health', 'HeartRate'))
const spo2 = computed(() => getMetric('collar-health', 'SPO2'))
const weight = computed(() => getMetric('pet-house', 'PetHouse:Weight'))
const motionX = computed(() => getMetric('collar-motion', 'X'))
const motionY = computed(() => getMetric('collar-motion', 'Y'))
const motionZ = computed(() => getMetric('collar-motion', 'Z'))
const longitude = computed(() => getMetric('collar-location', 'Longitude'))
const latitude = computed(() => getMetric('collar-location', 'Latitude'))

const petMood = computed(() => emotion.value.currentMood || '开心')
const stepCount = ref(0)
const lastMagnitude = ref(0)
const hrChartEl = ref(null)
const HR_MAX_POINTS = 30
const STEP_THRESHOLD = 1.2
const hrHistory = ref([])

let hrChart = null

const isOnline = computed(() => !loading.value && metricSections.value?.length > 0)
const isConnecting = computed(() => loading.value)
const isWeb = !Capacitor.isNativePlatform()

const hasCoordinates = computed(() => {
  const lng = Number(longitude.value?.value)
  const lat = Number(latitude.value?.value)
  return Number.isFinite(lng) && Number.isFinite(lat)
})

const locationStatusText = computed(() => (hasCoordinates.value ? '定位正常' : '等待定位'))

function buildHrOption(data) {
  const values = data.map((item) => item.v)
  return {
    animation: false,
    grid: { top: 8, bottom: 4, left: 0, right: 0 },
    xAxis: {
      type: 'category',
      show: false,
      boundaryGap: false,
      data: data.map((item) => item.t)
    },
    yAxis: {
      type: 'value',
      show: false,
      min: (value) => Math.max(0, value.min - 10),
      max: (value) => value.max + 10
    },
    series: [
      {
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#d56a6a', width: 2.2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(213,106,106,0.18)' },
            { offset: 1, color: 'rgba(213,106,106,0.02)' }
          ])
        }
      }
    ]
  }
}

function initHrChart() {
  if (!hrChartEl.value || hrChart) return
  hrChart = echarts.init(hrChartEl.value)
  hrChart.setOption(buildHrOption(hrHistory.value))
}

function handleStatusTap() {
  refreshAll()
}

function getCurrentPosition() {
  if (!hasCoordinates.value) return null
  return [Number(longitude.value.value), Number(latitude.value.value)]
}

function getTrackPath() {
  if (locationTrack.value.length) {
    return locationTrack.value
      .map((point) => [Number(point.longitude), Number(point.latitude)])
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))
  }

  const current = getCurrentPosition()
  return current ? [current] : []
}

function updateTrack() {
  const path = getTrackPath()
  if (!map || !marker || !polyline || !path.length) return

  const current = path.at(-1)
  marker.setPosition(current)
  polyline.setPath(path)

  if (path.length > 1) {
    map.setFitView([marker, polyline], false, [24, 24, 24, 24], 15)
    return
  }

  map.setZoomAndCenter(15, current)
}

async function setupMap() {
  if (map || !mapContainer.value) return

  try {
    const AMap = await loadAmap()
    map = new AMap.Map(mapContainer.value, {
      zoom: amapConfig.defaultZoom,
      center: amapConfig.defaultCenter,
      viewMode: '2D',
      resizeEnable: true
    })

    marker = new AMap.Marker({
      position: amapConfig.defaultCenter,
      offset: new AMap.Pixel(-13, -30),
      title: 'Collar GPS'
    })

    polyline = new AMap.Polyline({
      path: [],
      strokeColor: '#4f7b99',
      strokeWeight: 4,
      strokeOpacity: 0.88,
      lineJoin: 'round',
      lineCap: 'round'
    })

    map.add(marker)
    map.add(polyline)
    updateTrack()
    mapError.value = ''
  } catch (error) {
    mapError.value = error instanceof Error ? error.message : '地图加载失败'
  }
}

watch(
  heartRateHistory,
  (points) => {
    const normalized = formatHistoryPoints(points).filter((item) => Number.isFinite(item.v)).slice(-HR_MAX_POINTS)
    hrHistory.value = normalized
    if (hrChart) hrChart.setOption(buildHrOption(hrHistory.value))
    else nextTick(initHrChart)
  },
  { immediate: true, deep: true }
)

watch([motionX, motionY, motionZ], () => {
  const x = Number(motionX.value?.value) || 0
  const y = Number(motionY.value?.value) || 0
  const z = Number(motionZ.value?.value) || 0
  const magnitude = Math.sqrt(x * x + y * y + z * z)
  if (lastMagnitude.value > 0 && Math.abs(magnitude - lastMagnitude.value) > STEP_THRESHOLD) {
    stepCount.value += 1
  }
  lastMagnitude.value = magnitude
})

watch([longitude, latitude, locationTrack], () => {
  updateTrack()
}, { deep: true })

onMounted(async () => {
  await refreshAll()
  startPolling()
  await nextTick()
  initHrChart()
  await setupMap()
})

onBeforeUnmount(() => {
  stopPolling()
  hrChart?.dispose()
  hrChart = null
  if (map) {
    map.destroy()
    map = null
    marker = null
    polyline = null
  }
})
</script>

<template>
  <main class="collar-page">
    <section class="hero-card">
      <div class="hero-main">
        <div class="avatar">
          <svg viewBox="0 0 40 40" width="24" height="24" fill="currentColor">
            <ellipse cx="12" cy="10" rx="4" ry="5" />
            <ellipse cx="28" cy="10" rx="4" ry="5" />
            <ellipse cx="7" cy="22" rx="3.5" ry="4.5" />
            <ellipse cx="33" cy="22" rx="3.5" ry="4.5" />
            <path d="M20 36c-6 0-12-4-12-9s4-8 12-8 12 3 12 8-6 9-12 9z" />
          </svg>
        </div>

        <div class="hero-copy">
          <h1>Lucky</h1>
          <p>金毛寻回犬 · 3 岁</p>
        </div>

        <button
          class="status-pill"
          :class="isOnline ? 'is-online' : isConnecting ? 'is-connecting' : 'is-offline'"
          @click="handleStatusTap"
        >
          <span class="status-dot"></span>
          {{ isOnline ? '在线' : isConnecting ? '连接中' : '离线' }}
        </button>
      </div>

      <div class="hero-meta">
        <span class="meta-pill">
          <span class="meta-dot"></span>
          {{ locationStatusText }}
        </span>
        <span class="meta-pill">当前心情 · {{ petMood }}</span>
        <span class="meta-note">{{ isWeb ? '网页模式' : '原生模式' }}</span>
      </div>
    </section>

    <p v-if="errorMessage" class="error-bar">{{ errorMessage }}</p>

    <section class="section-block health-section">
      <div class="section-heading">
        <h2>健康检测</h2>
      </div>

      <div class="health-grid">
        <article class="metric-card metric-card-wide">
          <div class="metric-top">
            <div class="metric-icon icon-heart">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <div>
              <span class="metric-title">心率</span>
              <div class="metric-value-row">
                <strong>{{ heartRate?.value ?? hrHistory[hrHistory.length - 1]?.v ?? '--' }}</strong>
                <span>bpm</span>
              </div>
            </div>
          </div>
          <div ref="hrChartEl" class="hr-chart"></div>
        </article>

        <article class="metric-card compact-card">
          <div class="metric-icon icon-spo2">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 2C12 2 5 10.5 5 15a7 7 0 0014 0c0-4.5-7-13-7-13z" />
            </svg>
          </div>
          <span class="metric-title">血氧</span>
          <div class="metric-value-row">
            <strong>{{ spo2?.value ?? '--' }}</strong>
            <span>%</span>
          </div>
        </article>

        <article class="metric-card compact-card">
          <div class="metric-icon icon-weight">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>
          <span class="metric-title">体重</span>
          <div class="metric-value-row">
            <strong>{{ weight?.value ?? '--' }}</strong>
            <span>kg</span>
          </div>
        </article>
      </div>
    </section>

    <section class="section-block">
      <div class="section-heading">
        <h2>位置轨迹</h2>
      </div>

      <article class="map-card">
        <div ref="mapContainer" class="map-panel" :class="{ empty: !hasCoordinates || !!mapError }">
          <div v-if="!hasCoordinates" class="map-overlay">
            <p>等待 GPS 坐标</p>
          </div>
          <div v-else-if="mapError" class="map-overlay">
            <p>地图加载失败</p>
            <span>{{ mapError }}</span>
          </div>
        </div>

        <div class="map-meta">
          <div class="map-meta-item">
            <span>经度</span>
            <strong>{{ longitude?.value ?? '--' }}</strong>
          </div>
          <div class="map-meta-item">
            <span>纬度</span>
            <strong>{{ latitude?.value ?? '--' }}</strong>
          </div>
          <div class="map-meta-item">
            <span>定位状态</span>
            <strong>{{ locationStatusText }}</strong>
          </div>
        </div>
      </article>
    </section>

    <section class="section-block">
      <div class="section-heading">
        <h2>活动状态</h2>
      </div>

      <div class="summary-grid">
        <article class="summary-card">
          <span class="summary-label">今日步数</span>
          <strong>{{ stepCount }}</strong>
          <span class="summary-foot">根据运动传感器估算</span>
        </article>

        <article class="summary-card">
          <span class="summary-label">情绪状态</span>
          <strong>{{ petMood }}</strong>
          <span class="summary-foot">当前表现较稳定</span>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.collar-page {
  max-width: var(--page-max-width);
  margin: 0 auto;
  padding: calc(env(safe-area-inset-top, 0px) + 18px) 16px calc(var(--tab-height) + var(--safe-bottom) + 38px);
}

.hero-card,
.metric-card,
.map-card,
.summary-card,
.section-block {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--color-shadow);
}

.hero-card {
  border-radius: 16px;
  padding: 14px 16px 12px;
  margin-bottom: 14px;
}

.hero-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: var(--color-surface-muted);
  color: #7e6a57;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hero-copy {
  flex: 1;
  min-width: 0;
}

.hero-copy h1 {
  font-size: 22px;
  line-height: 1.05;
  margin-bottom: 3px;
}

.hero-copy p {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.status-pill,
.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 11px;
  border-radius: 12px;
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: 12px;
}

.status-pill {
  border: 1px solid var(--color-divider);
  flex-shrink: 0;
}

.status-dot,
.meta-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
}

.is-online .status-dot,
.meta-dot {
  background: var(--color-success);
}

.is-connecting .status-dot {
  background: var(--color-warning);
}

.is-offline .status-dot {
  background: var(--color-text-muted);
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.meta-note {
  color: var(--color-text-muted);
  font-size: 12px;
}

.error-bar {
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(219, 106, 98, 0.14);
  background: rgba(219, 106, 98, 0.08);
  color: #b8534d;
  font-size: 13px;
}

.section-block {
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 14px;
}

.health-section {
  padding: 14px 14px 12px;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-heading h2 {
  font-size: 18px;
  line-height: 1.2;
}

.health-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 10px;
}

.metric-card {
  border-radius: 14px;
  padding: 12px;
}

.metric-card-wide {
  padding-bottom: 6px;
}

.compact-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 108px;
}

.metric-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.metric-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-heart {
  background: rgba(213, 106, 106, 0.12);
  color: #d56a6a;
}

.icon-spo2 {
  background: rgba(91, 156, 247, 0.12);
  color: #5b9cf7;
}

.icon-weight {
  background: rgba(126, 150, 174, 0.12);
  color: #70839a;
}

.metric-title {
  display: block;
  margin-bottom: 4px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.metric-value-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.metric-value-row strong {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.metric-value-row span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.hr-chart {
  height: 52px;
  margin-top: 6px;
}

.map-card {
  border-radius: 14px;
  overflow: hidden;
}

.map-panel {
  position: relative;
  height: 148px;
  background: linear-gradient(180deg, #eef1ee 0%, #ecefed 100%);
}

.map-panel.empty {
  display: flex;
}

.map-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(247, 246, 242, 0.9);
  color: var(--color-text-secondary);
  z-index: 1;
}

.map-overlay span {
  max-width: 220px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted);
}

.map-meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 12px 14px 14px;
}

.map-meta-item span {
  display: block;
  margin-bottom: 4px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.map-meta-item strong {
  font-size: 14px;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.summary-card {
  border-radius: 14px;
  padding: 14px;
}

.summary-label {
  display: block;
  margin-bottom: 10px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.summary-card strong {
  display: block;
  font-size: 28px;
  line-height: 1.1;
}

.summary-foot {
  display: block;
  margin-top: 8px;
  color: var(--color-text-muted);
  font-size: 12px;
}

@media (max-width: 520px) {
  .hero-main {
    gap: 10px;
  }

  .status-pill {
    min-width: 72px;
    justify-content: center;
  }

  .metric-card {
    padding: 10px;
  }

  .metric-value-row strong {
    font-size: 20px;
  }

  .map-meta {
    gap: 8px;
  }

  .map-meta-item strong {
    font-size: 13px;
  }
}
</style>
