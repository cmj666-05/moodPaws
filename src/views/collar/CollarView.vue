<script setup>
import { Capacitor } from '@capacitor/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { amapConfig } from '../../config/amap'
import { useMqtt } from '../../composables/useMqtt'
import { loadAmap } from '../../services/amap/loader'

const {
  status,
  errorMessage,
  metricSections,
  connect
} = useMqtt()

const mapContainer = ref(null)
const mapError = ref('')
const trackPointCount = ref(0)

let map = null
let marker = null
let polyline = null
const trackPoints = []

function getMetric(sectionKey, metricKey) {
  const section = metricSections.value?.find((item) => item.key === sectionKey)
  return section?.metrics?.find((item) => item.key === metricKey)
}

const heartRate = computed(() => getMetric('collar-health', 'HeartRate'))
const spo2 = computed(() => getMetric('collar-health', 'SPO2'))
const motionX = computed(() => getMetric('collar-motion', 'X'))
const motionY = computed(() => getMetric('collar-motion', 'Y'))
const motionZ = computed(() => getMetric('collar-motion', 'Z'))
const longitude = computed(() => getMetric('collar-location', 'Longitude'))
const latitude = computed(() => getMetric('collar-location', 'Latitude'))

const isOnline = computed(() => status.value === 'subscribed')
const isConnecting = computed(() => status.value === 'connecting' || status.value === 'connected')
const isAndroidRuntime = Capacitor.getPlatform() === 'android'
const hasCoordinates = computed(() => {
  const lng = Number(longitude.value?.value)
  const lat = Number(latitude.value?.value)
  return Number.isFinite(lng) && Number.isFinite(lat)
})

function handleStatusTap() {
  if (status.value === 'idle' || status.value === 'error') {
    connect()
  }
}

async function setupMap() {
  if (!isAndroidRuntime || map || !mapContainer.value) {
    return
  }

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
      strokeColor: '#1f8bff',
      strokeWeight: 5,
      strokeOpacity: 0.92,
      lineJoin: 'round',
      lineCap: 'round'
    })

    map.add(marker)
    map.add(polyline)
    updateTrack()
    mapError.value = ''
  } catch (error) {
    mapError.value = error instanceof Error ? error.message : 'Unknown map error'
  }
}

function getCurrentPosition() {
  if (!hasCoordinates.value) {
    return null
  }

  return [Number(longitude.value.value), Number(latitude.value.value)]
}

function appendTrackPoint(position) {
  const previousPoint = trackPoints.at(-1)
  if (previousPoint && previousPoint[0] === position[0] && previousPoint[1] === position[1]) {
    return
  }

  trackPoints.push(position)
  trackPointCount.value = trackPoints.length
}

function updateTrack() {
  const position = getCurrentPosition()
  if (!map || !marker || !polyline || !position) {
    return
  }

  appendTrackPoint(position)
  marker.setPosition(position)
  polyline.setPath(trackPoints)

  if (trackPoints.length > 1) {
    map.setFitView([marker, polyline], false, [36, 36, 36, 36], 15)
    return
  }

  map.setZoomAndCenter(15, position)
}

onMounted(async () => {
  connect()
  await nextTick()
  await setupMap()
})

watch([longitude, latitude], () => {
  updateTrack()
})

onBeforeUnmount(() => {
  if (map) {
    map.destroy()
    map = null
    marker = null
    polyline = null
  }
})
</script>

<template>
  <div class="collar-page">
    <section class="profile-card">
      <div class="profile-main">
        <div class="avatar">
          <svg viewBox="0 0 40 40" width="40" height="40" fill="rgba(255,255,255,0.9)">
            <ellipse cx="12" cy="10" rx="4" ry="5" />
            <ellipse cx="28" cy="10" rx="4" ry="5" />
            <ellipse cx="7" cy="22" rx="3.5" ry="4.5" />
            <ellipse cx="33" cy="22" rx="3.5" ry="4.5" />
            <path d="M20 36c-6 0-12-4-12-9s4-8 12-8 12 3 12 8-6 9-12 9z" />
          </svg>
        </div>
        <div class="profile-info">
          <h1 class="pet-name">Lucky</h1>
          <p class="pet-breed">金毛寻回犬 · 3岁</p>
          <p class="pet-mood">当前版本仅面向 Android 交付，GPS 区域会在安卓应用内加载高德地图。</p>
        </div>
      </div>
      <div class="profile-badges">
        <span
          class="badge"
          :class="isOnline ? 'badge-online' : isConnecting ? 'badge-connecting' : 'badge-offline'"
          @click="handleStatusTap"
        >
          <span class="badge-dot"></span>
          {{ isOnline ? '在线' : isConnecting ? '连接中' : '离线' }}
        </span>
        <span class="badge badge-gps">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M8 1a5 5 0 00-5 5c0 3.5 5 9 5 9s5-5.5 5-9a5 5 0 00-5-5zm0 7a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
          {{ hasCoordinates ? 'GPS 正常' : '等待定位' }}
        </span>
      </div>
    </section>

    <div v-if="errorMessage" class="error-bar">
      {{ errorMessage }}
    </div>

    <section class="section">
      <h2 class="section-title">健康监测</h2>
      <div class="health-grid">
        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon icon-heart">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
          </div>
          <div class="metric-value">
            <strong>{{ heartRate?.value ?? '--' }}</strong>
            <span class="metric-unit">bpm</span>
          </div>
          <p class="metric-label">心率</p>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon icon-spo2">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 2C12 2 5 10.5 5 15a7 7 0 0014 0c0-4.5-7-13-7-13z" />
              </svg>
            </div>
          </div>
          <div class="metric-value">
            <strong>{{ spo2?.value ?? '--' }}</strong>
            <span class="metric-unit">%</span>
          </div>
          <p class="metric-label">血氧</p>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">运动数据</h2>
      <div class="motion-card">
        <div class="motion-row">
          <div class="motion-item">
            <div class="motion-indicator" style="background: #ff8a4c">X</div>
            <strong class="motion-value">{{ motionX?.value ?? '--' }}</strong>
            <span class="motion-label">X 轴</span>
          </div>
          <div class="motion-divider"></div>
          <div class="motion-item">
            <div class="motion-indicator" style="background: #5b9cf7">Y</div>
            <strong class="motion-value">{{ motionY?.value ?? '--' }}</strong>
            <span class="motion-label">Y 轴</span>
          </div>
          <div class="motion-divider"></div>
          <div class="motion-item">
            <div class="motion-indicator" style="background: #36c49f">Z</div>
            <strong class="motion-value">{{ motionZ?.value ?? '--' }}</strong>
            <span class="motion-label">Z 轴</span>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-title-row">
        <h2 class="section-title">GPS 轨迹</h2>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--color-gps)">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
        </svg>
      </div>
      <div class="gps-card">
        <div
          ref="mapContainer"
          class="map-placeholder"
          :class="{ 'map-placeholder-empty': !isAndroidRuntime || !hasCoordinates || !!mapError }"
        >
          <div v-if="!isAndroidRuntime" class="map-overlay">
            <p class="map-hint">地图区域仅在 Android 应用内加载</p>
          </div>
          <div v-else-if="!hasCoordinates" class="map-overlay">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="var(--color-text-muted)" opacity="0.4">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <p class="map-hint">等待 GPS 坐标</p>
          </div>
          <div v-else-if="mapError" class="map-overlay">
            <p class="map-hint">高德地图加载失败</p>
            <p class="map-subhint">{{ mapError }}</p>
          </div>
        </div>
        <div class="gps-info">
          <div class="coord-item">
            <span class="coord-label">经度</span>
            <span class="coord-val">{{ longitude?.value ?? '--' }}</span>
          </div>
          <div class="coord-item">
            <span class="coord-label">纬度</span>
            <span class="coord-val">{{ latitude?.value ?? '--' }}</span>
          </div>
          <div class="coord-item">
            <span class="coord-label">轨迹点</span>
            <span class="coord-val">{{ trackPointCount }}</span>
          </div>
        </div>
      </div>
    </section>

    <div class="quick-actions">
      <button class="action-btn action-history">历史数据</button>
      <button class="action-btn action-settings">设备设置</button>
      <button class="action-btn action-emergency">紧急联系</button>
    </div>
  </div>
</template>

<style scoped>
.collar-page {
  padding: 16px;
  padding-top: calc(env(safe-area-inset-top, 0px) + 16px);
  padding-bottom: calc(var(--tab-height) + var(--safe-bottom) + 24px);
}

.profile-card {
  background: linear-gradient(135deg, #fcc89b 0%, #f5a27a 50%, #f08e6a 100%);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 20px;
}

.profile-main {
  display: flex;
  align-items: center;
  gap: 14px;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  border: 3px solid rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.pet-name {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}

.pet-breed {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  margin-top: 2px;
}

.pet-mood {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  margin-top: 4px;
}

.profile-badges {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.badge-online .badge-dot {
  background: #4ade80;
}

.badge-connecting .badge-dot {
  background: #facc15;
  animation: blink 1s infinite;
}

.badge-offline .badge-dot {
  background: rgba(255, 255, 255, 0.5);
}

.badge-offline {
  cursor: pointer;
}

.badge-gps {
  gap: 4px;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}

.error-bar {
  padding: 10px 14px;
  border-radius: var(--radius);
  background: #fef2f2;
  color: #dc2626;
  font-size: 13px;
  margin-bottom: 16px;
  border: 1px solid #fecaca;
}

.section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title-row .section-title {
  margin-bottom: 0;
}

.health-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.metric-card {
  background: var(--color-card);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.metric-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.metric-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-heart {
  background: var(--color-heart-bg);
  color: var(--color-heart);
}

.icon-spo2 {
  background: var(--color-spo2-bg);
  color: var(--color-spo2);
}

.metric-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.metric-value strong {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  color: var(--color-text);
}

.metric-unit {
  font-size: 14px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.metric-label {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-top: 6px;
}

.motion-card {
  background: var(--color-card);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.motion-row {
  display: flex;
  align-items: center;
}

.motion-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.motion-indicator {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}

.motion-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1;
}

.motion-label {
  font-size: 12px;
  color: var(--color-text-muted);
}

.motion-divider {
  width: 1px;
  height: 48px;
  background: var(--color-border);
  flex-shrink: 0;
}

.gps-card {
  background: var(--color-card);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.map-placeholder {
  position: relative;
  height: 180px;
  background: linear-gradient(135deg, #e8f4f0 0%, #dbeee8 50%, #cfe8e0 100%);
}

.map-placeholder-empty {
  display: flex;
}

.map-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, rgba(232, 244, 240, 0.9) 0%, rgba(207, 232, 224, 0.95) 100%);
  z-index: 1;
}

.map-hint {
  font-size: 13px;
  color: var(--color-text-muted);
}

.map-subhint {
  max-width: 220px;
  text-align: center;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.gps-info {
  display: flex;
  padding: 14px 16px;
  gap: 24px;
}

.coord-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.coord-label {
  font-size: 13px;
  color: var(--color-text-muted);
}

.coord-val {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.quick-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
  margin-bottom: 8px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 0;
  border-radius: 24px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  transition: opacity 0.15s;
}

.action-btn:active {
  opacity: 0.8;
}

.action-history {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
}

.action-settings {
  background: linear-gradient(135deg, #a8b8c8, #8896a6);
}

.action-emergency {
  background: linear-gradient(135deg, #fca5a5, #f87171);
}
</style>
