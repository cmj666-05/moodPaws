<script setup>
import { computed, ref } from 'vue'
import CollarView from './views/collar/CollarView.vue'
import DashboardView from './views/dashboard/DashboardView.vue'
import EmotionView from './views/emotion/EmotionView.vue'
import SocialView from './views/social/SocialView.vue'

const activeTab = ref('collar')

const tabs = [
  { key: 'collar', label: '项圈' },
  { key: 'house', label: '宠舍' },
  { key: 'emotion', label: '情绪' },
  { key: 'social', label: '社交' }
]

const tabViews = {
  collar: CollarView,
  house: DashboardView,
  emotion: EmotionView,
  social: SocialView
}

const activeComponent = computed(() => tabViews[activeTab.value] ?? null)
</script>

<template>
  <div class="app-shell">
    <main class="app-content">
      <component :is="activeComponent" v-if="activeComponent" />

      <section v-if="!activeComponent" class="placeholder-page">
        <div class="placeholder-card">
          <span class="placeholder-kicker">{{ tabs.find((tab) => tab.key === activeTab)?.label }}</span>
          <h2>{{ tabs.find((tab) => tab.key === activeTab)?.label }}功能即将开放</h2>
          <p>当前版本先聚焦项圈、宠舍与情绪模块，后续会补充更多宠物陪伴能力。</p>
        </div>
      </section>
    </main>

    <nav class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
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
  </div>
</template>

<style scoped src="./App.css"></style>
