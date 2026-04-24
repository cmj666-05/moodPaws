<script setup>
import { computed, ref, watch } from "vue";
import {
  clearManualApiBaseUrl,
  clearManualVideoStreamUrl,
  getVideoStreamUrl,
  saveManualApiBaseUrl,
  saveManualVideoStreamUrl,
  testApiBaseUrl,
  useApiEndpointState,
} from "../config/api";

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close", "saved"]);

const apiState = useApiEndpointState();
const draftUrl = ref("");
const draftVideoUrl = ref("");
const statusType = ref("");
const statusMessage = ref("");
const isTesting = ref(false);
const isSaving = ref(false);
const isResetting = ref(false);

const sourceLabel = computed(() => {
  const labelMap = {
    env: "构建配置",
    manual: "手动设置",
    mdns: "自动发现",
    cache: "历史缓存",
    default: "默认兜底",
  };

  return labelMap[apiState.source] || apiState.source || "未知来源";
});

const showRestoreButton = computed(
  () => apiState.canEditBaseUrl && apiState.isManualOverride,
);
const isEnvLocked = computed(() => apiState.isEnvOverride);
const currentAddress = computed(() => apiState.baseUrl || "");
const isVideoEnvLocked = computed(() => Boolean(apiState.video?.isEnvOverride));
const currentVideoAddress = computed(() => getVideoStreamUrl() || "");
const showVideoRestoreButton = computed(() =>
  Boolean(apiState.video?.canEditUrl && apiState.video?.manualUrl),
);
const canSaveChanges = computed(
  () => !isEnvLocked.value || !isVideoEnvLocked.value,
);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return;
    }

    draftUrl.value = getInitialDraftUrl();
    draftVideoUrl.value = getInitialVideoDraftUrl();
    resetStatus();
  },
  { immediate: true },
);

watch([draftUrl, draftVideoUrl], () => {
  if (!props.open) {
    return;
  }

  if (statusType.value === "success") {
    resetStatus();
  }
});

function getInitialDraftUrl() {
  if (apiState.isManualOverride && apiState.manualBaseUrl) {
    return apiState.manualBaseUrl;
  }

  if (apiState.source && apiState.source !== "default" && apiState.baseUrl) {
    return apiState.baseUrl;
  }

  return "";
}

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
  if (isTesting.value || isSaving.value || isResetting.value) {
    return;
  }

  emit("close");
}

async function handleTest() {
  isTesting.value = true;
  statusType.value = "";
  statusMessage.value = "";

  try {
    const result = await testApiBaseUrl(draftUrl.value);
    statusType.value = "success";
    statusMessage.value = `连接成功：${result.baseUrl}`;
  } catch (error) {
    statusType.value = "error";
    statusMessage.value =
      error instanceof Error ? error.message : "连接测试失败";
  } finally {
    isTesting.value = false;
  }
}

async function handleSave() {
  isSaving.value = true;
  statusType.value = "";
  statusMessage.value = "";

  try {
    const savedMessages = [];
    const trimmedApiUrl = draftUrl.value.trim();
    const trimmedVideoUrl = draftVideoUrl.value.trim();

    if (
      !isEnvLocked.value &&
      trimmedApiUrl &&
      trimmedApiUrl !== currentAddress.value
    ) {
      const result = await saveManualApiBaseUrl(trimmedApiUrl);
      savedMessages.push(`后端已切换到：${result.baseUrl}`);
    }

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
      error instanceof Error ? error.message : "保存服务器地址失败";
  } finally {
    isSaving.value = false;
  }
}

function handleReset() {
  isResetting.value = true;
  statusType.value = "";
  statusMessage.value = "";

  try {
    clearManualApiBaseUrl();
    draftUrl.value = "";
    statusType.value = "success";
    statusMessage.value = "已恢复自动发现，下次刷新会重新查找局域网服务";
    emit("saved");
  } catch (error) {
    statusType.value = "error";
    statusMessage.value =
      error instanceof Error ? error.message : "恢复自动发现失败";
  } finally {
    isResetting.value = false;
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
            <p class="endpoint-sheet-kicker">服务器连接</p>
            <h2 id="endpoint-sheet-title">设置服务地址</h2>
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
          <label class="endpoint-sheet-label" for="api-base-url"
            >服务器地址</label
          >
          <input
            id="api-base-url"
            v-model.trim="draftUrl"
            class="endpoint-sheet-input"
            type="url"
            inputmode="url"
            :disabled="isEnvLocked"
            placeholder="http://10.8.34.150:3001/api"
          />
          <p class="endpoint-sheet-help">
            填写完整地址，推荐格式：`http://你的电脑IP:3001/api`
          </p>
          <p v-if="isEnvLocked" class="endpoint-sheet-help">
            当前构建已通过 `.env` 固定服务器地址，应用内修改已禁用。
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
            class="endpoint-sheet-btn secondary"
            :disabled="isTesting || isSaving || isResetting || isEnvLocked"
            @click="handleTest"
          >
            {{ isTesting ? "测试中..." : "测试连接" }}
          </button>
          <button
            type="button"
            class="endpoint-sheet-btn primary"
            :disabled="isTesting || isSaving || isResetting || !canSaveChanges"
            @click="handleSave"
          >
            {{ isSaving ? "保存中..." : "保存并使用" }}
          </button>
        </footer>

        <div
          v-if="showRestoreButton || showVideoRestoreButton"
          class="endpoint-sheet-reset"
        >
          <button
            v-if="showRestoreButton"
            type="button"
            class="endpoint-sheet-text-btn"
            :disabled="isTesting || isSaving || isResetting"
            @click="handleReset"
          >
            {{ isResetting ? "切换中..." : "恢复自动发现" }}
          </button>
          <button
            v-if="showVideoRestoreButton"
            type="button"
            class="endpoint-sheet-text-btn"
            :disabled="isTesting || isSaving || isResetting"
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
