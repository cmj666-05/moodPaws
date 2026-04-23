<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ensureVideoStreamUrl, getVideoStreamUrl } from "../../config/api";
import { usePetApi } from "../../composables/usePetApi";

const fallbackHouse = {
  id: 1,
  name: "宠舍状态",
  petName: "等待设备",
  petProfile: "暂无数据",
  notificationCount: 0,
  environment: {
    temperature: { value: "--", status: "等待数据", unit: "°C" },
    humidity: { value: "--", unit: "%" },
    airQuality: { value: "--", unit: "" },
    co2: { value: "--", unit: "ppm" },
  },
  liveView: {
    hasVideo: true,
    status: "在线看护",
    videoStreamUrl: "",
  },
  emotion: {
    primary: "待识别",
    secondary: "等待同步",
  },
};

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
  stopEmotionPolling,
} = usePetApi();

const hasVideoError = ref(false);
const isVideoConnecting = ref(false);
const reconnectAttempt = ref(0);
let deferredVideoDiscoveryTask = null;

const allMetrics = computed(() =>
  metricSections.value.flatMap((section) => section.metrics || []),
);

const getMetric = (keys) =>
  computed(() => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    return allMetrics.value.find((metric) => keyList.includes(metric.key));
  });

const temperatureMetric = getMetric(["Collar:temp"]);
const humidityMetric = getMetric(["Collar:humidity"]);
const co2Metric = getMetric(["Collar:CO2"]);
const airQualityMetric = getMetric(["Collar:airQuality"]);
const resolvedVideoStreamUrl = computed(() => getVideoStreamUrl());

function scheduleDeferredTask(callback, timeout = 240) {
  if (typeof window === "undefined") {
    return null;
  }

  if (typeof window.requestIdleCallback === "function") {
    return window.requestIdleCallback(callback, { timeout });
  }

  return window.setTimeout(callback, timeout);
}

function clearDeferredTask(taskId) {
  if (taskId == null || typeof window === "undefined") {
    return;
  }

  if (typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(taskId);
    return;
  }

  window.clearTimeout(taskId);
}

function formatMetricDisplay(metric, fallback) {
  const value = metric?.value;
  const unit = metric?.unit || fallback.unit || "";

  if (value === undefined || value === null || value === "") {
    return {
      value: fallback.value,
      unit,
    };
  }

  return {
    value,
    unit,
  };
}

const petProfile = computed(() => {
  const sourceDevice = latestTelemetry.value.source?.deviceName;
  return sourceDevice && sourceDevice !== "--"
    ? "设备已连接"
    : fallbackHouse.petProfile;
});
const sourceDeviceName = computed(() => {
  const sourceDevice = latestTelemetry.value.source?.deviceName;
  return sourceDevice && sourceDevice !== "--" ? sourceDevice : fallbackHouse.petName;
});

const selectedHouse = computed(() => ({
  ...fallbackHouse,
  petName: sourceDeviceName.value,
  petProfile: petProfile.value,
  liveView: {
    ...fallbackHouse.liveView,
    hasVideo: Boolean(resolvedVideoStreamUrl.value),
    videoStreamUrl: resolvedVideoStreamUrl.value,
  },
  environment: {
    temperature: {
      value:
        temperatureMetric.value?.value ??
        fallbackHouse.environment.temperature.value,
      status: temperatureMetric.value
        ? "实时同步"
        : fallbackHouse.environment.temperature.status,
      unit:
        temperatureMetric.value?.unit ||
        fallbackHouse.environment.temperature.unit,
    },
    humidity: {
      value:
        Number(humidityMetric.value?.value) ||
        fallbackHouse.environment.humidity.value,
      unit:
        humidityMetric.value?.unit || fallbackHouse.environment.humidity.unit,
    },
    airQuality: formatMetricDisplay(
      airQualityMetric.value,
      fallbackHouse.environment.airQuality,
    ),
    co2: formatMetricDisplay(co2Metric.value, fallbackHouse.environment.co2),
  },
  emotion: {
    primary: emotion.value?.currentMood || fallbackHouse.emotion.primary,
    secondary: errorMessage.value
      ? "稍后再试"
      : loading.value
        ? "正在同步"
        : fallbackHouse.emotion.secondary,
  },
}));

const streamSrc = computed(() => {
  const url = selectedHouse.value.liveView.videoStreamUrl;
  if (!url) return "";
  return reconnectAttempt.value === 0
    ? url
    : `${url}${url.includes("?") ? "&" : "?"}t=${reconnectAttempt.value}`;
});

const liveViewStatus = computed(() => {
  if (!selectedHouse.value.liveView.hasVideo) {
    if (isVideoConnecting.value) return "搜索中";
    return loading.value ? "发现视频中" : "暂无画面";
  }

  if (isVideoConnecting.value) return "连接中";
  if (hasVideoError.value) return "暂时离线";
  return selectedHouse.value.liveView.status;
});

function handleStreamLoad() {
  isVideoConnecting.value = false;
  hasVideoError.value = false;
}

function handleStreamError() {
  isVideoConnecting.value = false;
  hasVideoError.value = true;
}

async function reconnectStream() {
  if (!selectedHouse.value.liveView.hasVideo) {
    openVideoSettings();
    return;
  }

  hasVideoError.value = false;
  isVideoConnecting.value = true;
  reconnectAttempt.value += 1;
}

function scheduleVideoDiscovery() {
  clearDeferredTask(deferredVideoDiscoveryTask);
  hasVideoError.value = false;
  isVideoConnecting.value = Boolean(resolvedVideoStreamUrl.value);
  deferredVideoDiscoveryTask = scheduleDeferredTask(async () => {
    deferredVideoDiscoveryTask = null;

    try {
      const resolvedUrl = await ensureVideoStreamUrl({ reason: "dashboard" });
      isVideoConnecting.value = Boolean(resolvedUrl);
    } catch {
      isVideoConnecting.value = false;
    }
  }, 360);
}

function openVideoSettings() {
  window.dispatchEvent(new Event("moodpaws:open-api-sheet"));
}

watch(
  resolvedVideoStreamUrl,
  (url, previousUrl) => {
    if (!url) {
      hasVideoError.value = false;
      isVideoConnecting.value = false;
      reconnectAttempt.value = 0;
      return;
    }

    if (url !== previousUrl) {
      hasVideoError.value = false;
      isVideoConnecting.value = true;
      reconnectAttempt.value = 0;
    }
  },
  { immediate: true },
);

onMounted(async () => {
  await Promise.all([
    refreshTelemetryBundle({ includeHistory: false, includeTrack: false }),
    refreshEmotionBundle(),
  ]);
  startTelemetryPolling();
  startEmotionPolling();
  scheduleVideoDiscovery();
});

onBeforeUnmount(() => {
  stopTelemetryPolling();
  stopEmotionPolling();
  clearDeferredTask(deferredVideoDiscoveryTask);
});
</script>

<template>
  <div class="pet-house-view">
    <section class="boarding-card">
      <header class="card-header">
        <div class="header-copy">
          <span class="page-kicker">宠舍总览</span>
          <h1 class="page-title">今天也在好好陪伴</h1>
        </div>

        <div class="header-top">
          <div class="dog-avatar-container">
            <div class="dog-avatar" aria-label="宠舍设备">舍</div>
          </div>
          <div class="boarding-info">
            <div class="house-name">{{ selectedHouse.name }}</div>
            <div class="buddy-info">
              <span class="status-dot"></span>{{ selectedHouse.petName }} ·
              {{ selectedHouse.petProfile }}
            </div>
          </div>
          <div class="notification-bell" aria-label="照护提醒">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span v-if="selectedHouse.notificationCount" class="badge">{{
              selectedHouse.notificationCount
            }}</span>
          </div>
        </div>
      </header>

      <section class="section">
        <div class="section-heading">
          <h3 class="section-title">环境监测</h3>
          <span class="section-note">{{
            selectedHouse.environment.temperature.status
          }}</span>
        </div>
        <div class="env-grid">
          <div class="env-card temperature">
            <div style="display: flex; gap: 20px">
              <div class="env-icon env-icon-temperature" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 4a2 2 0 0 0-2 2v7.2a4 4 0 1 0 4 0V6a2 2 0 0 0-2-2Z"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M12 10v6"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
              <div class="env-label">温度</div>
            </div>

            <div class="env-value">
              <span>{{ selectedHouse.environment.temperature.value }}</span>
              <span class="env-unit">{{
                selectedHouse.environment.temperature.unit
              }}</span>
            </div>
          </div>

          <div class="env-card humidity">
            <div style="display: flex; gap: 20px">
              <div class="env-icon env-icon-humidity" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3.5s-5 6.1-5 10a5 5 0 0 0 10 0c0-3.9-5-10-5-10Z"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <div class="env-label">湿度</div>
            </div>
            <div class="env-value">
              <span>{{ selectedHouse.environment.humidity.value }}</span>
              <span class="env-unit">{{
                selectedHouse.environment.humidity.unit
              }}</span>
            </div>
          </div>

          <div class="env-card air-quality air-quality-combined">
            <div class="env-metric-group">
              <div class="env-label">空气质量</div>
              <div class="env-value">
                <span>{{ selectedHouse.environment.airQuality.value }}</span>
                <span
                  v-if="selectedHouse.environment.airQuality.unit"
                  class="env-unit"
                  >{{ selectedHouse.environment.airQuality.unit }}</span
                >
              </div>
            </div>
            <div class="env-metric-group env-metric-group-secondary">
              <div class="env-sub-label">CO2 浓度</div>
              <div class="env-value env-value-secondary">
                <span>{{ selectedHouse.environment.co2.value }}</span>
                <span
                  v-if="selectedHouse.environment.co2.unit"
                  class="env-unit"
                  >{{ selectedHouse.environment.co2.unit }}</span
                >
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-heading">
          <h3 class="section-title">实时看护</h3>
        </div>
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
              <span class="video-overlay-text"
                >正在连接看护画面，请稍等一下</span
              >
            </div>
            <div
              v-else-if="!selectedHouse.liveView.hasVideo || hasVideoError"
              class="video-overlay offline"
            >
              <span class="video-icon">看护</span>
              <span class="video-overlay-text">
                {{
                  selectedHouse.liveView.hasVideo
                    ? "看护画面暂时离线，宠舍数据仍会继续同步"
                    : "还没有填写视频地址，可在连接设置里补充 RDK 视频流地址"
                }}
              </span>
              <button
                type="button"
                class="reconnect-button"
                @click="reconnectStream"
              >
                {{
                  selectedHouse.liveView.hasVideo ? "重新连接" : "去填写地址"
                }}
              </button>
            </div>
            <span
              class="video-badge"
              :class="{ offline: hasVideoError, connecting: isVideoConnecting }"
              >{{ liveViewStatus }}</span
            >
          </div>
        </div>
      </section>
    </section>
  </div>
</template>

<style scoped src="./DashboardView.css"></style>
