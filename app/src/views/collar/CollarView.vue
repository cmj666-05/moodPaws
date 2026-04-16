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

const isValidCoordinatePair = (lng, lat) =>
  Number.isFinite(lng) &&
  Number.isFinite(lat) &&
  lng >= -180 &&
  lng <= 180 &&
  lat >= -90 &&
  lat <= 90

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
  latestTelemetry,
  heartRateHistory,
  locationTrack,
  emotion,
  homeMetrics,
  refreshAll,
  refreshTelemetryBundle,
  refreshEmotionBundle,
  startTelemetryPolling,
  startEmotionPolling,
  stopTelemetryPolling,
  stopEmotionPolling
} = usePetApi()

const mapContainer = ref(null)
const mapError = ref('')

let map = null
let marker = null
let polyline = null

const heartRate = computed(() => homeMetrics.value.heartRate)
const spo2 = computed(() => homeMetrics.value.spo2)
const weight = computed(() => homeMetrics.value.weight)
const motionX = computed(() => homeMetrics.value.motionX)
const motionY = computed(() => homeMetrics.value.motionY)
const motionZ = computed(() => homeMetrics.value.motionZ)
const longitude = computed(() => homeMetrics.value.longitude)
const latitude = computed(() => homeMetrics.value.latitude)

const petMood = computed(() => emotion.value.currentMood || '开心')
const stepCount = computed(() => Number(latestTelemetry.value?.stepCount) || 0)
const latestTelemetryAt = computed(() => Number(latestTelemetry.value?.lastActiveAt || latestTelemetry.value?.receivedAt) || 0)
const hrChartEl = ref(null)
const HR_MAX_POINTS = 30
const hrHistory = ref([])

let hrChart = null

const isOnline = computed(() => Boolean(latestTelemetry.value?.isOnline && latestTelemetry.value.sections?.length > 0))
const isConnecting = computed(() => loading.value && !latestTelemetryAt.value)
const isWeb = !Capacitor.isNativePlatform()

const hasCoordinates = computed(() => {
  const lng = Number(longitude.value?.value)
  const lat = Number(latitude.value?.value)
  return isValidCoordinatePair(lng, lat)
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
      .filter(([lng, lat]) => isValidCoordinatePair(lng, lat))
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

watch([longitude, latitude, locationTrack], () => {
  updateTrack()
}, { deep: true })

onMounted(async () => {
  await Promise.all([refreshTelemetryBundle(), refreshEmotionBundle()])
  startTelemetryPolling()
  startEmotionPolling()
  await nextTick()
  initHrChart()
  await setupMap()
})

onBeforeUnmount(() => {
  stopTelemetryPolling()
  stopEmotionPolling()
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
          <span class="summary-foot">由服务端根据首页计步口径统计</span>
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

<style scoped src="./CollarView.css"></style>
