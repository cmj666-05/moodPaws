<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Capacitor } from "@capacitor/core";
import { getVideoStreamUrl } from "../../config/api";
import { usePetApi } from "../../composables/usePetApi";

const petPhotoUrl =
  "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=240&q=80";

const emptyHouseState = {
  name: "当前宠舍",
  petName: "Lucky",
  petProfile: "金毛寻回犬 · 3 岁",
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
    primary: "开心",
    secondary: "想玩耍",
  },
};

const {
  loading,
  errorMessage,
  latestTelemetry,
  metricSections,
  mqttMetricMap,
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

const getMetric = (keys) =>
  computed(() => {
    const keyList = Array.isArray(keys) ? keys : [keys];
    return keyList
      .map((key) => mqttMetricMap.value[key])
      .find((metric) => metric);
  });

const temperatureMetric = getMetric(["PetHouse:Temp"]);
const humidityMetric = getMetric(["PetHouse:Humi"]);
const co2Metric = getMetric(["PetHouse:CO2"]);
const airQualityMetric = getMetric(["PetHouse:MQ135"]);
const resolvedVideoStreamUrl = computed(() => getVideoStreamUrl());
const hasTelemetryData = computed(() =>
  Boolean(metricSections.value.length || Object.keys(mqttMetricMap.value).length),
);

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
    : emptyHouseState.petProfile;
});

const petName = computed(() => {
  return emptyHouseState.petName;
});

const selectedHouse = computed(() => ({
  ...emptyHouseState,
  petName: petName.value,
  petProfile: petProfile.value,
  liveView: {
    ...emptyHouseState.liveView,
    hasVideo: Boolean(resolvedVideoStreamUrl.value),
    videoStreamUrl: resolvedVideoStreamUrl.value,
  },
  environment: {
    temperature: {
      value:
        temperatureMetric.value?.value ??
        emptyHouseState.environment.temperature.value,
      status: temperatureMetric.value
        ? "实时同步"
        : emptyHouseState.environment.temperature.status,
      unit:
        temperatureMetric.value?.unit ||
        emptyHouseState.environment.temperature.unit,
    },
    humidity: {
      ...formatMetricDisplay(
        humidityMetric.value,
        emptyHouseState.environment.humidity,
      ),
    },
    airQuality: formatMetricDisplay(
      airQualityMetric.value,
      emptyHouseState.environment.airQuality,
    ),
    co2: formatMetricDisplay(co2Metric.value, emptyHouseState.environment.co2),
  },
  emotion: {
    primary: emotion.value?.currentMood || emptyHouseState.emotion.primary,
    secondary: errorMessage.value
      ? "稍后再试"
      : loading.value
        ? "正在同步"
        : emptyHouseState.emotion.secondary,
  },
}));

const streamSrc = computed(() => {
  const url = selectedHouse.value.liveView.videoStreamUrl;
  if (!url) return "";
  return reconnectAttempt.value === 0
    ? url
    : `${url}${url.includes("?") ? "&" : "?"}t=${reconnectAttempt.value}`;
});
const shouldUseNativeVideoFrame = computed(() =>
  Capacitor.isNativePlatform() && Boolean(streamSrc.value),
);
const nativeVideoFrameSrcdoc = computed(() => {
  if (!shouldUseNativeVideoFrame.value) {
    return "";
  }

  const src = escapeHtmlAttribute(streamSrc.value);

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #000;
    }

    img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      background: #000;
    }
  </style>
</head>
<body>
  <img id="stream" src="${src}" alt="">
  <script>
    const img = document.getElementById('stream');
    const notify = (status) => parent.postMessage({
      type: 'moodpaws-video-frame',
      status,
      src: img.currentSrc || img.src
    }, '*');
    img.addEventListener('load', () => notify('load'));
    img.addEventListener('error', () => notify('error'));
    setTimeout(() => notify('load'), 1600);
  <\/script>
</body>
</html>`;
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

function handleNativeVideoMessage(event) {
  const payload = event?.data;
  if (!payload || payload.type !== "moodpaws-video-frame") {
    return;
  }

  if (payload.status === "error") {
    handleStreamError();
    return;
  }

  handleStreamLoad();
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
  deferredVideoDiscoveryTask = null;
  hasVideoError.value = false;
  isVideoConnecting.value = Boolean(resolvedVideoStreamUrl.value);
}

function openVideoSettings() {
  window.dispatchEvent(new Event("moodpaws:open-api-sheet"));
}

function escapeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  window.addEventListener("message", handleNativeVideoMessage);
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
  window.removeEventListener("message", handleNativeVideoMessage);
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
            <img class="dog-avatar" :src="petPhotoUrl" alt="可爱的宠物照片" />
          </div>
          <div class="boarding-info">
            <div class="house-name">{{ selectedHouse.name }}</div>
            <div class="buddy-info">
              <span class="status-dot" :class="{ 'is-muted': !hasTelemetryData }"></span>{{ selectedHouse.petName }} ·
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
            <iframe
              v-if="
                selectedHouse.liveView.hasVideo &&
                !hasVideoError &&
                shouldUseNativeVideoFrame
              "
              :key="streamSrc"
              :srcdoc="nativeVideoFrameSrcdoc"
              title="宠舍监控画面"
              class="video-stream video-frame"
              :class="{ connecting: isVideoConnecting }"
              @load="handleStreamLoad"
              @error="handleStreamError"
            ></iframe>
            <img
              v-else-if="selectedHouse.liveView.hasVideo && !hasVideoError"
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
                    : "还没有填写视频地址，可在服务设置里补充 RDK 视频流地址"
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
