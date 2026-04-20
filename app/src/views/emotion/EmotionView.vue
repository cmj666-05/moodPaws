<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { usePetApi } from '../../composables/usePetApi'

const {
  emotion,
  refreshEmotionBundle,
  startEmotionPolling,
  stopEmotionPolling
} = usePetApi()

const emotionCatalog = [
  {
    key: 'angry',
    label: '生气',
    mark: '生',
    brief: '高警觉',
    summary: '它可能被刺激到了，先减少打扰、降低噪声，会比强行互动更合适。',
    accent: '#d96b5f',
    soft: 'rgba(217, 107, 95, 0.14)',
    glow: 'rgba(217, 107, 95, 0.22)'
  },
  {
    key: 'anxious',
    label: '焦虑',
    mark: '焦',
    brief: '需要稳定感',
    summary: '这会更像对环境变化的敏感反应，熟悉的陪伴和稳定节奏能让它更快放松。',
    accent: '#e0a24f',
    soft: 'rgba(224, 162, 79, 0.16)',
    glow: 'rgba(224, 162, 79, 0.2)'
  },
  {
    key: 'happy',
    label: '开心',
    mark: '开',
    brief: '状态轻松',
    summary: '整体情绪比较积极，现在适合互动、奖励，或者安排一点轻松活动。',
    accent: '#58b57d',
    soft: 'rgba(88, 181, 125, 0.16)',
    glow: 'rgba(88, 181, 125, 0.2)'
  },
  {
    key: 'lonely',
    label: '孤独',
    mark: '孤',
    brief: '等待回应',
    summary: '它更像是在等陪伴或反馈，可以适当增加互动频率，让环境多一点回应感。',
    accent: '#6e95d8',
    soft: 'rgba(110, 149, 216, 0.16)',
    glow: 'rgba(110, 149, 216, 0.22)'
  },
  {
    key: 'sad',
    label: '难过',
    mark: '难',
    brief: '情绪偏低',
    summary: '现在更适合安静观察，减少刺激，再结合休息和食欲一起判断状态变化。',
    accent: '#8a7fb3',
    soft: 'rgba(138, 127, 179, 0.16)',
    glow: 'rgba(138, 127, 179, 0.22)'
  }
]

const fallbackMood = {
  key: 'unknown',
  label: '',
  mark: '--',
  brief: '暂无情绪数据',
  summary: '当前还没有可用的真实情绪返回，页面会在收到真实结果后再更新。',
  accent: '#7d8a99',
  soft: 'rgba(125, 138, 153, 0.14)',
  glow: 'rgba(125, 138, 153, 0.2)'
}

const moodMetaMap = new Map(emotionCatalog.map((item) => [item.label, item]))

const currentMood = computed(() =>
  typeof emotion.value.currentMood === 'string' ? emotion.value.currentMood.trim() : ''
)
const hasMoodData = computed(() => Boolean(currentMood.value))
const currentMoodDisplay = computed(() => currentMood.value || '等待同步')
const currentMoodMeta = computed(() => moodMetaMap.get(currentMood.value) || fallbackMood)
const createdAtText = computed(() => formatTime(emotion.value.createdAt))
const heroSummary = computed(() =>
  hasMoodData.value ? currentMoodMeta.value.summary : fallbackMood.summary
)

const historyBadges = computed(() =>
  Array.isArray(emotion.value.history) ? emotion.value.history.slice(0, 4) : []
)

const moodOptions = computed(() =>
  emotionCatalog.map((item) => ({
    ...item,
    active: item.label === currentMood.value
  }))
)

const heroTheme = computed(() => ({
  '--emotion-accent': currentMoodMeta.value.accent,
  '--emotion-soft': currentMoodMeta.value.soft,
  '--emotion-glow': currentMoodMeta.value.glow
}))

onMounted(async () => {
  await refreshEmotionBundle()
  startEmotionPolling()
})

onBeforeUnmount(() => {
  stopEmotionPolling()
})

function formatTime(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return '--'
  return new Date(parsed).toLocaleString('zh-CN', { hour12: false })
}
</script>

<template>
  <main class="emotion-page">
    <section class="emotion-card" :style="heroTheme">
      <div class="card-top">
        <span class="card-kicker">情绪状态</span>
      </div>

      <div class="hero-layout">
        <div class="hero-copy">
          <h1>{{ currentMoodDisplay }}</h1>
          <p class="hero-brief">{{ currentMoodMeta.brief }}</p>
          <p class="hero-summary">{{ heroSummary }}</p>
        </div>

        <div class="hero-badge" aria-hidden="true">
          <div class="hero-badge-core">{{ currentMoodMeta.mark }}</div>
        </div>
      </div>

      <div class="card-foot">
        <span v-if="createdAtText !== '--'" class="meta-chip">更新于 {{ createdAtText }}</span>
        <span v-if="historyBadges.length" class="meta-chip">已返回摘要</span>
      </div>

      <div class="state-strip">
        <article
          v-for="item in moodOptions"
          :key="item.key"
          class="state-pill"
          :class="{ 'state-pill-active': item.active }"
          :style="{ '--mood-accent': item.accent, '--mood-soft': item.soft }"
        >
          <span class="state-pill-mark">{{ item.mark }}</span>
          <span class="state-pill-text">
            <strong>{{ item.label }}</strong>
            <small>{{ item.brief }}</small>
          </span>
        </article>
      </div>
    </section>

    <section v-if="historyBadges.length" class="summary-card">
      <div class="summary-head">
        <span class="card-kicker">补充摘要</span>
        <h2>当前返回内容</h2>
      </div>

      <div class="summary-grid">
        <div
          v-for="(item, index) in historyBadges"
          :key="`${item.label}-${index}`"
          class="summary-pill"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped src="./EmotionView.css"></style>
