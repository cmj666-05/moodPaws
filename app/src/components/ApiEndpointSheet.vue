<script setup>
import { computed, ref, watch } from "vue";
import {
  clearManualVideoStreamUrl,
  getVideoStreamUrl,
  saveManualVideoStreamUrl,
  useApiEndpointState,
} from "../config/api";
import {
  aliyunIotConfig,
  getAliyunIotMissingFields,
  getAliyunMqttMissingFields,
  isAliyunIotConfigured,
  isAliyunMqttConfigured,
} from "../config/aliyun-iot";
import { getLocalStorageModeLabel } from "../services/pet/pet-data-service";

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close", "saved"]);

const apiState = useApiEndpointState();
const draftVideoUrl = ref("");
const statusType = ref("");
const statusMessage = ref("");
const isSaving = ref(false);
const isResetting = ref(false);

const realtimeConfigured = computed(() => isAliyunMqttConfigured());
const missingRealtimeFields = computed(() => getAliyunMqttMissingFields());
const historyConfigured = computed(() => isAliyunIotConfigured());
const missingHistoryFields = computed(() => getAliyunIotMissingFields());
const cloudStatusText = computed(() =>
  realtimeConfigured.value
    ? `MQTT 已配置 ${aliyunIotConfig.productKey} / ${aliyunIotConfig.mqtt.topics.join(", ")}`
    : `缺少 ${missingRealtimeFields.value.join(", ")}`,
);
const historyStatusText = computed(() =>
  historyConfigured.value
    ? `OpenAPI 历史回补已启用：${aliyunIotConfig.devices.join(", ")}`
    : `OpenAPI 历史回补未启用：缺少 ${missingHistoryFields.value.join(", ")}`,
);
const storageModeText = computed(() => getLocalStorageModeLabel());
const isVideoEnvLocked = computed(() => Boolean(apiState.video?.isEnvOverride));
const currentVideoAddress = computed(() => getVideoStreamUrl() || "");
const showVideoRestoreButton = computed(() =>
  Boolean(apiState.video?.canEditUrl && apiState.video?.manualUrl),
);
const canSaveChanges = computed(() => !isVideoEnvLocked.value);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    draftVideoUrl.value = getInitialVideoDraftUrl();
    resetStatus();
  },
  { immediate: true },
);

watch(draftVideoUrl, () => {
  if (!props.open) {
    return;
  }

  if (statusType.value === "success") {
    resetStatus();
  }
});

function getInitialVideoDraftUrl() {
  if (apiState.video?.manualUrl) {
    return apiState.video.manualUrl;
  }

  if (currentVideoAddress.value) {
    return currentVideoAddress.value;
  }

  return "";
}

function resetStatus() {
  statusType.value = "";
  statusMessage.value = "";
}

function closeSheet() {
  if (isSaving.value || isResetting.value) {
    return;
  }

  emit("close");
}

async function handleSave() {
  isSaving.value = true;
  statusType.value = "";
  statusMessage.value = "";

  try {
    const savedMessages = [];
    const trimmedVideoUrl = draftVideoUrl.value.trim();

    if (!isVideoEnvLocked.value) {
      if (trimmedVideoUrl) {
        const result = saveManualVideoStreamUrl(trimmedVideoUrl);
        savedMessages.push(`视频流已切换到：${result.url}`);
      } else if (showVideoRestoreButton.value) {
        clearManualVideoStreamUrl();
        savedMessages.push("已清空视频流地址");
      }
    }

    if (!savedMessages.length) {
      savedMessages.push("没有需要保存的变更");
    }

    statusType.value = "success";
    statusMessage.value = savedMessages.join("；");
    emit("saved");
  } catch (error) {
    statusType.value = "error";
    statusMessage.value =
      error instanceof Error ? error.message : "保存连接设置失败";
  } finally {
    isSaving.value = false;
  }
}

function handleVideoReset() {
  isResetting.value = true;
  statusType.value = "";
  statusMessage.value = "";

  try {
    clearManualVideoStreamUrl();
    draftVideoUrl.value = "";
    statusType.value = "success";
    statusMessage.value = "已清空视频流地址";
    emit("saved");
  } catch (error) {
    statusType.value = "error";
    statusMessage.value =
      error instanceof Error ? error.message : "清空视频地址失败";
  } finally {
    isResetting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="endpoint-sheet-root">
      <div class="endpoint-sheet-backdrop" @click="closeSheet"></div>

      <section
        class="endpoint-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="endpoint-sheet-title"
      >
        <div class="endpoint-sheet-handle"></div>

        <header class="endpoint-sheet-header">
          <div>
            <p class="endpoint-sheet-kicker">云端直连</p>
            <h2 id="endpoint-sheet-title">连接设置</h2>
          </div>
          <button
            type="button"
            class="endpoint-sheet-close"
            aria-label="关闭"
            @click="closeSheet"
          >
            ×
          </button>
        </header>

        <div class="endpoint-sheet-body">
          <label class="endpoint-sheet-label">阿里云 IoT</label>
          <div
            class="endpoint-sheet-status"
            :class="{ success: realtimeConfigured, error: !realtimeConfigured }"
          >
            {{ cloudStatusText }}
          </div>
          <p class="endpoint-sheet-help">
            实时设备数据会由 App 直连阿里云 MQTT 接收，并写入本地 {{ storageModeText }}。
          </p>
          <p class="endpoint-sheet-help">
            {{ historyStatusText }}
          </p>
          <p class="endpoint-sheet-help">
            阿里云连接配置来自 `.env.local`，不会在这里保存。
          </p>

          <label
            class="endpoint-sheet-label endpoint-sheet-input-label"
            for="video-stream-url"
            >视频地址</label
          >
          <input
            id="video-stream-url"
            v-model.trim="draftVideoUrl"
            class="endpoint-sheet-input"
            type="url"
            inputmode="url"
            :disabled="isVideoEnvLocked"
            placeholder="如 http://192.168.1.88:5000"
          />
          <p v-if="isVideoEnvLocked" class="endpoint-sheet-help">
            当前构建已通过 `.env` 固定视频地址，应用内修改已禁用。
          </p>

          <div
            v-if="statusMessage"
            class="endpoint-sheet-status"
            :class="{
              success: statusType === 'success',
              error: statusType === 'error',
            }"
          >
            {{ statusMessage }}
          </div>
        </div>

        <footer class="endpoint-sheet-actions">
          <button
            type="button"
            class="endpoint-sheet-btn primary"
            :disabled="isSaving || isResetting || !canSaveChanges"
            @click="handleSave"
          >
            {{ isSaving ? "保存中..." : "保存并使用" }}
          </button>
        </footer>

        <div
          v-if="showVideoRestoreButton"
          class="endpoint-sheet-reset"
        >
          <button
            v-if="showVideoRestoreButton"
            type="button"
            class="endpoint-sheet-text-btn"
            :disabled="isSaving || isResetting"
            @click="handleVideoReset"
          >
            {{ isResetting ? "处理中..." : "清空视频地址" }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped src="./ApiEndpointSheet.css"></style>
