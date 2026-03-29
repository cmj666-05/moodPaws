<script setup>
import { ref } from 'vue'
import CollarView from './views/collar/CollarView.vue'

const activeTab = ref('collar')

const tabs = [
  { key: 'collar', label: '项圈' },
  { key: 'house', label: '寄养屋' },
  { key: 'emotion', label: '情感' },
  { key: 'social', label: '社交' }
]
</script>

<template>
  <div class="app-shell">
    <main class="app-content">
      <CollarView v-show="activeTab === 'collar'" />
      <div v-if="activeTab !== 'collar'" class="placeholder-page">
        <div class="placeholder-inner">
          <div class="placeholder-circle">
            {{ tabs.find(t => t.key === activeTab)?.label?.charAt(0) }}
          </div>
          <h2 class="placeholder-title">{{ tabs.find(t => t.key === activeTab)?.label }}</h2>
          <p class="placeholder-hint">功能开发中</p>
        </div>
      </div>
    </main>

    <nav class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <!-- 项圈 - signal icon -->
        <svg v-if="tab.key === 'collar'" class="tab-svg" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="14" r="3" fill="currentColor"/>
          <path d="M7.05 9.05a7 7 0 0 1 9.9 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M4.22 6.22a11 11 0 0 1 15.56 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        <!-- 寄养屋 - house icon -->
        <svg v-else-if="tab.key === 'house'" class="tab-svg" viewBox="0 0 24 24" fill="none">
          <path d="M3 12l2-2m0 0l7-7 7 7m-14 0v9a1 1 0 001 1h3m10-10l2 2m-2-2v9a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <!-- 情感 - heart icon -->
        <svg v-else-if="tab.key === 'emotion'" class="tab-svg" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor"/>
        </svg>
        <!-- 社交 - people icon -->
        <svg v-else-if="tab.key === 'social'" class="tab-svg" viewBox="0 0 24 24" fill="none">
          <circle cx="9" cy="7" r="3" stroke="currentColor" stroke-width="1.8"/>
          <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.85" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
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

.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(var(--tab-height) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background: var(--color-card);
  display: flex;
  align-items: stretch;
  border-top: 1px solid var(--color-border);
  z-index: 100;
}

.tab-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--color-text-muted);
  transition: color 0.2s;
  padding: 0;
}

.tab-btn.active {
  color: var(--color-primary);
}

.tab-svg {
  width: 24px;
  height: 24px;
}

.tab-text {
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
}

.placeholder-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - var(--tab-height));
  padding: 24px;
}

.placeholder-inner {
  text-align: center;
}

.placeholder-circle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fcc89b, #f5a27a);
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.placeholder-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
}

.placeholder-hint {
  color: var(--color-text-muted);
  font-size: 14px;
}
</style>
