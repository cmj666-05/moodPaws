<script setup>
import { Capacitor } from '@capacitor/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { amapConfig } from '../../config/amap'
import locationTargetIcon from '../../assets/location-target-icon.svg'
import { usePetApi } from '../../composables/usePetApi'
import { loadAmap } from '../../services/amap/loader'

const petPhotoUrl =
  'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=240&q=80'

let echartsRuntimePromise = null

async function loadEchartsRuntime() {
  if (echartsRuntimePromise) return echartsRuntimePromise

  echartsRuntimePromise = Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers')
  ])
    .then(([echartsCore, echartsCharts, echartsComponents, echartsRenderers]) => {
      echartsCore.use([
        echartsCharts.LineChart,
        echartsComponents.GridComponent,
        echartsRenderers.CanvasRenderer
      ])

      return {
        graphic: echartsCore.graphic,
        init: echartsCore.init
      }
    })
    .catch((error) => {
      echartsRuntimePromise = null
      throw error
    })

  return echartsRuntimePromise
}

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
  refreshTelemetryDetails,
  refreshEmotionBundle,
  startTelemetryPolling,
  startEmotionPolling,
  stopTelemetryPolling,
  stopEmotionPolling
} = usePetApi()

const mapContainer = ref(null)
const mapSectionEl = ref(null)
const mapError = ref('')
const isMapSectionVisible = ref(false)
const isLocatingCurrentPosition = ref(false)
const hrChartEl = ref(null)
const hrHistory = ref([])

const HR_MAX_POINTS = 30
const LOCATION_FOCUS_ZOOM = 17
const POSITION_EQUAL_TOLERANCE = 0.000002

let map = null
let marker = null
let polyline = null
let mapSetupPromise = null
let mapVisibilityObserver = null
let hrChart = null
let hrChartInitPromise = null
let hrChartGraphic = null
let deferredTelemetryDetailsTask = null

const heartRate = computed(() => homeMetrics.value.heartRate)
const spo2 = computed(() => homeMetrics.value.spo2)
const weight = computed(() => homeMetrics.value.weight)
const longitude = computed(() => homeMetrics.value.longitude)
const latitude = computed(() => homeMetrics.value.latitude)
const heartRateValue = computed(() => heartRate.value?.value ?? hrHistory.value[hrHistory.value.length - 1]?.v)
const spo2Value = computed(() => spo2.value?.value)
const weightValue = computed(() => weight.value?.value)

const sourceDeviceName = computed(() => {
  const deviceName = latestTelemetry.value.source?.deviceName
  return deviceName && deviceName !== '--' ? deviceName : ''
})
const collarTitle = computed(() => sourceDeviceName.value || 'Lucky')
const collarSubtitle = computed(() =>
  sourceDeviceName.value ? `${sourceDeviceName.value} · ${platformText.value}` : `金毛寻回犬 · 3 岁 · ${platformText.value}`
)
const petMood = computed(() => emotion.value.currentMood || '开心')
const stepCount = computed(() => Number(latestTelemetry.value?.stepCount) || 0)
const latestTelemetryAt = computed(() =>
  Number(latestTelemetry.value?.lastActiveAt || latestTelemetry.value?.receivedAt) || 0
)

const isOnline = computed(() =>
  Boolean(latestTelemetry.value?.isOnline && latestTelemetry.value.sections?.length > 0)
)
const isConnecting = computed(() => loading.value && !latestTelemetryAt.value)
const isWeb = !Capacitor.isNativePlatform()

const hasCoordinates = computed(() => {
  const lng = Number(longitude.value?.value)
  const lat = Number(latitude.value?.value)
  return isValidCoordinatePair(lng, lat)
})

const locationStatusText = computed(() => (hasCoordinates.value ? '定位正常' : '定位中'))
const statusText = computed(() => (isOnline.value ? '在线' : isConnecting.value ? '连接中' : '暂离线'))
const platformText = computed(() => (isWeb ? '智能项圈' : '贴身守护'))

function scheduleDeferredTask(callback, timeout = 240) {
  if (typeof window === 'undefined') return null

  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, { timeout })
  }

  return window.setTimeout(callback, timeout)
}

function clearDeferredTask(taskId) {
  if (taskId == null || typeof window === 'undefined') return

  if (typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(taskId)
    return
  }

  window.clearTimeout(taskId)
}

function buildHrOption(data, graphic) {
  const values = data.map((item) => item.v)
  return {
    animation: false,
    grid: { top: 4, bottom: 2, left: 0, right: 0 },
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
        lineStyle: { color: '#d97368', width: 2 },
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(217,115,104,0.18)' },
            { offset: 1, color: 'rgba(217,115,104,0.02)' }
          ])
        }
      }
    ]
  }
}

async function initHrChart() {
  if (!hrChartEl.value || hrChart || hrChartInitPromise || !hrHistory.value.length) return

  hrChartInitPromise = loadEchartsRuntime()
    .then((runtime) => {
      if (!hrChartEl.value || hrChart) return

      hrChartGraphic = runtime.graphic
      hrChart = runtime.init(hrChartEl.value)
      hrChart.setOption(buildHrOption(hrHistory.value, hrChartGraphic))
    })
    .catch(() => {
      hrChartGraphic = null
    })
    .finally(() => {
      hrChartInitPromise = null
    })

  return hrChartInitPromise
}

function handleStatusTap() {
  refreshAll({ force: true })
}

function openServerSettings() {
  window.dispatchEvent(new Event('moodpaws:open-api-sheet'))
}

function getCurrentPosition() {
  if (!hasCoordinates.value) return null
  return [Number(longitude.value.value), Number(latitude.value.value)]
}

function buildCurrentLocationMarkerContent() {
  return `
    <div
      style="
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: #ffffff;
        border: 2px solid #d85745;
        box-shadow: 0 0 0 3px rgba(216, 87, 69, 0.18), 0 6px 14px rgba(95, 76, 55, 0.16);
      "
    ></div>
  `
}

function isSamePosition(firstPosition, secondPosition) {
  if (!Array.isArray(firstPosition) || !Array.isArray(secondPosition)) return false

  return (
    Math.abs(Number(firstPosition[0]) - Number(secondPosition[0])) <= POSITION_EQUAL_TOLERANCE &&
    Math.abs(Number(firstPosition[1]) - Number(secondPosition[1])) <= POSITION_EQUAL_TOLERANCE
  )
}

function centerMapOnPosition(position, zoom = LOCATION_FOCUS_ZOOM) {
  if (!map || !position) return

  marker?.setPosition(position)
  map.setZoomAndCenter(zoom, position)
}

function getTrackPath() {
  const trackedPath = locationTrack.value
    .map((point) => [Number(point.longitude), Number(point.latitude)])
    .filter(([lng, lat]) => isValidCoordinatePair(lng, lat))
  if (locationTrack.value.length) {
    const current = getCurrentPosition()

    if (!current) {
      return trackedPath
    }

    return isSamePosition(trackedPath.at(-1), current) ? trackedPath : [...trackedPath, current]
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
    map.setFitView([marker, polyline], false, [16, 16, 16, 16], 15)
    return
  }

  map.setZoomAndCenter(15, current)
}

async function setupMap() {
  if (
    map ||
    mapSetupPromise ||
    !mapContainer.value ||
    !isMapSectionVisible.value ||
    !hasCoordinates.value
  ) {
    return mapSetupPromise
  }

  mapSetupPromise = (async () => {
    try {
      const AMap = await loadAmap()
      if (!mapContainer.value || map) return
      const initialCenter = getCurrentPosition() || amapConfig.defaultCenter

      map = new AMap.Map(mapContainer.value, {
        zoom: amapConfig.defaultZoom,
        center: initialCenter,
        viewMode: '2D',
        resizeEnable: true
      })

      marker = new AMap.Marker({
        position: initialCenter,
        anchor: 'center',
        offset: new AMap.Pixel(0, 0),
        content: buildCurrentLocationMarkerContent(),
        title: '当前位置',
        zIndex: 120
      })

      polyline = new AMap.Polyline({
        strokeColor: '#5f8f72',
        strokeWeight: 4,
        strokeOpacity: 0.88,
        lineJoin: 'round',
        lineCap: 'round',
        zIndex: 80
      })

      map.add(polyline)
      map.add(marker)
      updateTrack()
      mapError.value = ''
    } catch (error) {
      mapError.value = error instanceof Error ? error.message : '地图加载失败'
    }
  })()
    .finally(() => {
      mapSetupPromise = null
    })

  return mapSetupPromise
}

async function handleLocateCurrentPosition() {
  if (isLocatingCurrentPosition.value) return

  isLocatingCurrentPosition.value = true
  mapError.value = ''

  try {
    await refreshTelemetryBundle({ force: true, includeHistory: false, includeTrack: true })
    isMapSectionVisible.value = true
    await nextTick()
    await setupMap()

    const current = getCurrentPosition()
    if (!current) {
      throw new Error('当前位置暂不可用')
    }

    updateTrack()
    centerMapOnPosition(current)
  } catch (error) {
    mapError.value = error instanceof Error ? error.message : '定位失败'
  } finally {
    isLocatingCurrentPosition.value = false
  }
}

function observeMapSection() {
  if (!mapSectionEl.value || typeof window === 'undefined') {
    isMapSectionVisible.value = true
    return
  }

  if (typeof window.IntersectionObserver !== 'function') {
    isMapSectionVisible.value = true
    return
  }

  mapVisibilityObserver = new window.IntersectionObserver(
    (entries) => {
      const visible = entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)
      if (!visible) return

      isMapSectionVisible.value = true
      mapVisibilityObserver?.disconnect()
      mapVisibilityObserver = null
    },
    { rootMargin: '100px 0px' }
  )

  mapVisibilityObserver.observe(mapSectionEl.value)
}

function scheduleTelemetryDetailsHydration() {
  clearDeferredTask(deferredTelemetryDetailsTask)
  deferredTelemetryDetailsTask = scheduleDeferredTask(async () => {
    deferredTelemetryDetailsTask = null

    try {
      await refreshTelemetryDetails()
    } catch {
      // Non-critical history and track hydration should not block the first screen.
    }
  }, 600)
}

watch(
  heartRateHistory,
  (points) => {
    const normalized = formatHistoryPoints(points)
      .filter((item) => Number.isFinite(item.v))
      .slice(-HR_MAX_POINTS)

    hrHistory.value = normalized

    if (hrChart && hrChartGraphic) {
      hrChart.setOption(buildHrOption(hrHistory.value, hrChartGraphic))
      return
    }

    if (hrHistory.value.length) {
      nextTick(() => {
        initHrChart()
      })
    }
  },
  { immediate: true, deep: true }
)

watch([longitude, latitude, locationTrack], () => {
  updateTrack()
}, { deep: true })

watch([hasCoordinates, isMapSectionVisible], ([coordinatesReady, sectionVisible]) => {
  if (coordinatesReady && sectionVisible) {
    setupMap()
  }
})

onMounted(async () => {
  await Promise.all([
    refreshTelemetryBundle({ includeHistory: false, includeTrack: false }),
    refreshEmotionBundle()
  ])
  startTelemetryPolling()
  startEmotionPolling()
  await nextTick()
  observeMapSection()
  scheduleTelemetryDetailsHydration()
})

onBeforeUnmount(() => {
  stopTelemetryPolling()
  stopEmotionPolling()
  clearDeferredTask(deferredTelemetryDetailsTask)
  mapVisibilityObserver?.disconnect()
  mapVisibilityObserver = null
  hrChart?.dispose()
  hrChart = null
  hrChartGraphic = null
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
        <div class="avatar" aria-label="Lucky 的金毛头像">
          <img class="pet-avatar-photo" :src="petPhotoUrl" alt="Lucky 的金毛头像" />
        </div>

        <div class="hero-copy">
          <span class="hero-kicker">项圈监测</span>
          <h1>{{ collarTitle }}</h1>
          <p>{{ collarSubtitle }}</p>
        </div>

        <button
          class="status-pill"
          :class="isOnline ? 'is-online' : isConnecting ? 'is-connecting' : 'is-offline'"
          @click="handleStatusTap"
        >
          <span class="status-dot"></span>
          {{ statusText }}
        </button>
      </div>

      <div class="hero-meta">
        <span class="meta-pill">
          <span class="meta-dot"></span>
          {{ locationStatusText }}
        </span>
        <span class="meta-pill">心情 · {{ petMood }}</span>
      </div>
    </section>

    

    <section class="section-block health-section">
      <div class="section-heading">
        <div>
          <span class="section-kicker">HEALTH</span>
          <h2>健康监测</h2>
        </div>
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
                <strong>{{ heartRateValue ?? '未记录' }}</strong>
                <span v-if="heartRateValue != null">bpm</span>
              </div>
            </div>
          </div>
          <div ref="hrChartEl" class="hr-chart"></div>
        </article>

        <article class="metric-card compact-card">
          <div style="display: flex;gap:20px;">
            <div class="metric-icon icon-spo2">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 2C12 2 5 10.5 5 15a7 7 0 0014 0c0-4.5-7-13-7-13z" />
            </svg>
          </div>
          <span class="metric-title">血氧</span>
          </div>
          <div class="metric-value-row">
            <strong>{{ spo2Value ?? '未记录' }}</strong>
            <span v-if="spo2Value != null">%</span>
          </div>
        </article>

        <article class="metric-card compact-card">
          <div style="display: flex;gap:20px;">
            <div class="metric-icon icon-weight">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>
          <span class="metric-title">体重</span>
          </div>
          <div class="metric-value-row">
            <strong>{{ weightValue ?? '未记录' }}</strong>
            <span v-if="weightValue != null">kg</span>
          </div>
        </article>
      </div>
    </section>

    <section class="section-block location-section">
      <div class="section-heading location-heading">
        <h2>位置轨迹</h2>
        <button
          type="button"
          class="map-locate-button"
          :class="{ 'is-loading': isLocatingCurrentPosition }"
          :disabled="isLocatingCurrentPosition"
          :aria-label="isLocatingCurrentPosition ? '正在定位当前位置' : '定位到当前位置'"
          :title="isLocatingCurrentPosition ? '正在定位当前位置' : '定位到当前位置'"
          @click="handleLocateCurrentPosition"
        >
          <img class="map-locate-icon" :src="locationTargetIcon" alt="" aria-hidden="true" />
        </button>
      </div>

      <article ref="mapSectionEl" class="map-card">
        <div ref="mapContainer" class="map-panel" :class="{ empty: !hasCoordinates || !!mapError }">
          <div v-if="!hasCoordinates" class="map-overlay">
            <p>定位中</p>
            <span>项圈在线后会自动显示位置</span>
          </div>
          <div v-else-if="mapError" class="map-overlay">
            <p>地图加载失败</p>
            <span>{{ mapError }}</span>
          </div>
        </div>

        <div class="map-meta">
          <div class="map-meta-item">
            <span>经度</span>
            <strong>{{ longitude?.value ?? '待更新' }}</strong>
          </div>
          <div class="map-meta-item">
            <span>纬度</span>
            <strong>{{ latitude?.value ?? '待更新' }}</strong>
          </div>
        </div>
      </article>
    </section>

    <section class="section-block activity-section">
      <div class="section-heading">
        <div>
          <span class="section-kicker">ACTIVITY</span>
          <h2>活动状态</h2>
        </div>
      </div>

      <div class="summary-grid">
        <article class="summary-card">
          <span class="summary-label">今日步数</span>
          <strong>{{ stepCount }}</strong>
          <span class="summary-foot">今日活动记录</span>
        </article>

        <article class="summary-card">
          <span class="summary-label">情绪状态</span>
          <strong>{{ petMood }}</strong>
          <span class="summary-foot">当前较稳定</span>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped src="./CollarView.css"></style>
