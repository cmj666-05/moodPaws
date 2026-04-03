<script setup>
import { ref } from 'vue'
import CollarView from './views/collar/CollarView.vue'
import EmotionView from './views/emotion/EmotionView.vue'

const activeTab = ref('collar')

const tabs = [
  { key: 'collar', label: '项圈' },
  { key: 'house', label: '宠舍' },
  { key: 'emotion', label: '情绪' },
  { key: 'social', label: '社交' }
]
</script>

<template>
  <div class="app-shell">
    <main class="app-content">
      <CollarView v-if="activeTab === 'collar'" />
      <EmotionView v-else-if="activeTab === 'emotion'" />

      <section v-else class="placeholder-page">
        <div class="placeholder-card">
          <span class="placeholder-kicker">{{ tabs.find((tab) => tab.key === activeTab)?.label }}</span>
          <h2>{{ tabs.find((tab) => tab.key === activeTab)?.label }}功能即将开放</h2>
          <p>当前版本先聚焦项圈与情绪模块，后续会补充更多宠物陪伴能力。</p>
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

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.placeholder-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - var(--tab-height));
  padding: 24px 20px calc(var(--tab-height) + var(--safe-bottom) + 24px);
}

.placeholder-card {
  width: min(100%, 420px);
  padding: 28px 24px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--color-shadow);
}

.placeholder-kicker {
  display: inline-block;
  margin-bottom: 10px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.placeholder-card h2 {
  font-size: 24px;
  line-height: 1.2;
  margin-bottom: 10px;
}

.placeholder-card p {
  color: var(--color-text-secondary);
}

.tab-bar {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 10px;
  height: calc(var(--tab-height) + var(--safe-bottom));
  padding: 8px 8px calc(8px + var(--safe-bottom));
  border: 1px solid rgba(31, 41, 51, 0.07);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(18px);
  box-shadow: 0 12px 34px rgba(31, 41, 51, 0.08);
  display: flex;
  align-items: stretch;
  z-index: 100;
}

.tab-btn {
  flex: 1;
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--color-text-muted);
  transition: color 0.2s ease, background-color 0.2s ease;
}

.tab-btn.active {
  color: var(--color-text);
  background: rgba(31, 41, 51, 0.045);
}

.tab-icon-wrap {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-svg {
  width: 22px;
  height: 22px;
}

.tab-text {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
}
</style>
