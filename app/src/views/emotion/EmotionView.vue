<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { usePetApi } from '../../composables/usePetApi'

const {
  emotion,
  refreshEmotionBundle,
  startEmotionPolling,
  stopEmotionPolling
} = usePetApi()

const petPhotoUrl =
  'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=240&q=80'

const emotionCatalog = [
  {
    key: 'angry',
    label: '生气',
    mark: '气',
    brief: '需要一点距离',
    summary: '它可能被刺激到了，先减少打扰、降低噪声，给它一点安静空间会更合适。',
    accent: '#d97368',
    soft: 'rgba(217, 115, 104, 0.14)',
    glow: 'rgba(217, 115, 104, 0.22)'
  },
  {
    key: 'anxious',
    label: '焦虑',
    mark: '焦',
    brief: '需要稳定感',
    summary: '这更像是对环境变化的敏感反应。熟悉的陪伴、稳定的节奏和轻声安抚能帮它更快放松。',
    accent: '#e4a14e',
    soft: 'rgba(228, 161, 78, 0.16)',
    glow: 'rgba(228, 161, 78, 0.22)'
  },
  {
    key: 'happy',
    label: '开心',
    mark: '乐',
    brief: '状态轻松',
    summary: '整体情绪比较积极，现在适合互动、奖励，或者安排一点轻松活动。',
    accent: '#5da974',
    soft: 'rgba(93, 169, 116, 0.16)',
    glow: 'rgba(93, 169, 116, 0.22)'
  },
  {
    key: 'lonely',
    label: '孤独',
    mark: '陪',
    brief: '等待回应',
    summary: '它更像是在等待陪伴或反馈，可以适当增加互动频率，让环境多一点回应感。',
    accent: '#6d9fc1',
    soft: 'rgba(109, 159, 193, 0.16)',
    glow: 'rgba(109, 159, 193, 0.22)'
  },
  {
    key: 'sad',
    label: '难过',
    mark: '抱',
    brief: '情绪偏低',
    summary: '现在更适合安静观察，减少刺激，再结合休息和食欲一起判断状态变化。',
    accent: '#8e82af',
    soft: 'rgba(142, 130, 175, 0.16)',
    glow: 'rgba(142, 130, 175, 0.22)'
  }
]

const fallbackMood = {
  key: 'unknown',
  label: '',
  mark: '等',
  brief: '今日还没有新记录',
  summary: '先保持日常陪伴，新的情绪状态会在有足够信号后自动呈现。',
  accent: '#7d8a78',
  soft: 'rgba(125, 138, 120, 0.14)',
  glow: 'rgba(125, 138, 120, 0.2)'
}

const moodMetaMap = new Map(emotionCatalog.map((item) => [item.label, item]))

const currentMood = computed(() =>
  typeof emotion.value.currentMood === 'string' ? emotion.value.currentMood.trim() : ''
)
const hasMoodData = computed(() => Boolean(currentMood.value))
const currentMoodDisplay = computed(() => currentMood.value || '正在倾听它的情绪')
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
        <span class="sync-chip">{{ createdAtText !== '--' ? '已更新' : '今日待观察' }}</span>
      </div>

      <div class="hero-layout">
        <div class="hero-copy">
          <h1>{{ currentMoodDisplay }}</h1>
          <p class="hero-brief">{{ currentMoodMeta.brief }}</p>
          <p class="hero-summary">{{ heroSummary }}</p>
        </div>

        <div class="hero-badge" aria-hidden="true">
          <img class="pet-avatar-photo" :src="petPhotoUrl" alt="Lucky 的金毛头像" />
          <div class="hero-badge-core">{{ currentMoodMeta.mark }}</div>
        </div>
      </div>

      <div class="card-foot">
        <span v-if="createdAtText !== '--'" class="meta-chip">更新于 {{ createdAtText }}</span>
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

    <section class="summary-card">
      <div class="summary-head">
        <span class="card-kicker">陪伴建议</span>
        <h2>{{ historyBadges.length ? '情绪小结' : '陪伴小贴士' }}</h2>
      </div>

      <div v-if="historyBadges.length" class="summary-grid">
        <div
          v-for="(item, index) in historyBadges"
          :key="`${item.label}-${index}`"
          class="summary-pill"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>

      <p v-else class="empty-copy">
        暂时没有新的情绪变化。保持熟悉的作息和温柔互动，就是很好的陪伴。
      </p>
    </section>
  </main>
</template>

<style scoped src="./EmotionView.css"></style>
