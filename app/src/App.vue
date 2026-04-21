<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import ApiEndpointSheet from './components/ApiEndpointSheet.vue'

const activeTab = ref('collar')
const activeViewKey = ref(0)
const showEndpointSheet = ref(false)
let preloadTaskId = null

const tabs = [
  { key: 'collar', label: '项圈' },
  { key: 'house', label: '宠舍' },
  { key: 'emotion', label: '情绪' },
  { key: 'social', label: '社交' }
]

const viewLoaders = {
  collar: () => import('./views/collar/CollarView.vue'),
  house: () => import('./views/dashboard/DashboardView.vue'),
  emotion: () => import('./views/emotion/EmotionView.vue'),
  social: () => import('./views/social/SocialView.vue')
}

const tabViews = {
  collar: defineAsyncComponent(viewLoaders.collar),
  house: defineAsyncComponent(viewLoaders.house),
  emotion: defineAsyncComponent(viewLoaders.emotion),
  social: defineAsyncComponent(viewLoaders.social)
}

const activeComponent = computed(() => tabViews[activeTab.value] ?? null)
const activeViewCacheKey = computed(() => `${activeTab.value}:${activeViewKey.value}`)

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

function preloadTabView(tabKey) {
  const loader = viewLoaders[tabKey]
  if (!loader) {
    return
  }

  loader().catch(() => {
    // Ignore preload failures and let the normal async component path retry later.
  })
}

function preloadInactiveViews() {
  tabs
    .filter((tab) => tab.key !== activeTab.value)
    .forEach((tab, index) => {
      window.setTimeout(() => {
        preloadTabView(tab.key)
      }, index * 120)
    })
}

function openEndpointSheet() {
  showEndpointSheet.value = true
}

function closeEndpointSheet() {
  showEndpointSheet.value = false
}

function handleEndpointSaved() {
  activeViewKey.value += 1
  showEndpointSheet.value = false
}

function handleOpenSheetEvent() {
  showEndpointSheet.value = true
}

onMounted(() => {
  window.addEventListener('moodpaws:open-api-sheet', handleOpenSheetEvent)
  preloadTaskId = scheduleDeferredTask(() => {
    preloadTaskId = null
    preloadInactiveViews()
  }, 700)
})

onBeforeUnmount(() => {
  window.removeEventListener('moodpaws:open-api-sheet', handleOpenSheetEvent)
  clearDeferredTask(preloadTaskId)
  preloadTaskId = null
})
</script>

<template>
  <div class="app-shell">
    <main class="app-content">
      <KeepAlive :max="tabs.length">
        <component :is="activeComponent" :key="activeViewCacheKey" v-if="activeComponent" />
      </KeepAlive>

      <section v-if="!activeComponent" class="placeholder-page">
        <div class="placeholder-card">
          <span class="placeholder-kicker">{{ tabs.find((tab) => tab.key === activeTab)?.label }}</span>
          <h2>{{ tabs.find((tab) => tab.key === activeTab)?.label }}功能即将开放</h2>
          <p>当前版本先照顾项圈、宠舍与情绪模块，后续会补充更多宠物陪伴能力。</p>
        </div>
      </section>
    </main>

    <nav class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @pointerenter="preloadTabView(tab.key)"
        @focus="preloadTabView(tab.key)"
        @touchstart.passive="preloadTabView(tab.key)"
        @click="activeTab = tab.key"
      >
        <span class="tab-icon-wrap">
          <svg v-if="tab.key === 'collar'" class="tab-svg" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="14" r="2.8" fill="currentColor" />
            <path d="M7.3 9.2a6.7 6.7 0 0 1 9.4 0" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
            <path d="M4.3 6.3a10.8 10.8 0 0 1 15.4 0" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
          </svg>
          <svg v-else-if="tab.key === 'house'" class="tab-svg" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 11.6 12 5l8 6.6M6.5 10.2V19h4.5v-4h2v4h4.5v-8.8"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
            />
          </svg>
          <svg v-else-if="tab.key === 'emotion'" class="tab-svg" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 20.2s-6.8-4.4-6.8-9.1A3.9 3.9 0 0 1 9.2 7c1.2 0 2.2.5 2.8 1.4A3.6 3.6 0 0 1 14.8 7a3.9 3.9 0 0 1 4 4.1c0 4.7-6.8 9.1-6.8 9.1Z"
              stroke="currentColor"
              stroke-linejoin="round"
              stroke-width="1.8"
            />
          </svg>
          <svg v-else class="tab-svg" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="8" r="2.8" stroke="currentColor" stroke-width="1.8" />
            <path d="M4.5 18.5c.6-2.6 2.6-4.2 5-4.2s4.4 1.6 5 4.2" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
            <path d="M16 9.2c1.6.2 2.8 1.4 3 2.9M16.7 14.6c1.5.4 2.6 1.7 2.8 3.4" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
          </svg>
        </span>
        <span class="tab-text">{{ tab.label }}</span>
      </button>
    </nav>

    <button type="button" class="server-fab" aria-label="服务器设置" @click="openEndpointSheet">
      <span class="server-fab-icon">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="4" y="5" width="16" height="5" rx="1.8" stroke="currentColor" stroke-width="1.7" />
          <rect x="4" y="14" width="16" height="5" rx="1.8" stroke="currentColor" stroke-width="1.7" />
          <circle cx="8" cy="7.5" r="0.9" fill="currentColor" />
          <circle cx="8" cy="16.5" r="0.9" fill="currentColor" />
        </svg>
      </span>
      <span class="server-fab-text">服务</span>
    </button>

    <ApiEndpointSheet
      :open="showEndpointSheet"
      @close="closeEndpointSheet"
      @saved="handleEndpointSaved"
    />
  </div>
</template>

<style scoped src="./App.css"></style>
