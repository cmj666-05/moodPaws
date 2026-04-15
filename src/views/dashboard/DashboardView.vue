<script setup>
import { computed, onMounted, ref } from 'vue'
import { usePetApi } from '../../composables/usePetApi'

const {
  loading,
  errorMessage,
  sourceSummary,
  metricSections,
  rawPayloadText,
  latestTelemetry,
  statusText,
  refreshAll,
  clearTelemetry,
  refreshTelemetryBundle,
  refreshEmotionBundle,
  startTelemetryPolling,
  startEmotionPolling
} = usePetApi()

const showDebugPanel = ref(false)

const profile = {
  name: 'Lucky',
  breed: '金毛寻回犬',
  mood: '开心中',
  avatar: '🐶'
}

const heroHighlights = computed(() => [
  {
    label: '当前心情',
    value: profile.mood
  },
  {
    label: '设备状态',
    value: loading.value ? '同步中' : errorMessage.value ? '需关注' : '可互动'
  },
  {
    label: '数据来源',
    value: latestTelemetry.value.topic || '本地社交场景'
  }
])

const nearbyPets = [
  { id: 'luna', name: 'Luna', breed: '柯基', mood: '想玩耍', avatar: '🐕', style: { top: '12%', left: '14%' } },
  { id: 'max', name: 'Max', breed: '比格犬', mood: '很友好', avatar: '🐶', style: { top: '26%', right: '11%' } },
  { id: 'mochi', name: 'Mochi', breed: '波斯猫', mood: '慢热中', avatar: '🐱', style: { bottom: '14%', right: '18%' } }
]

const socialFeedResponse = ref({
  source: 'mock',
  updatedAt: '2026-04-10 09:30',
  tabs: [
    {
      key: 'nearby',
      label: '附近互动',
      items: [
        {
          id: '1',
          name: 'Luna',
          breed: '柯基',
          summary: '草地上完成了一次轻松碰一碰配对。',
          meta: '5 分钟前 · 气氛轻松',
          avatar: '🐕'
        },
        {
          id: '2',
          name: 'Max',
          breed: '比格犬',
          summary: '在玩耍区同步了最近活动偏好。',
          meta: '12 分钟前 · 精力充沛',
          avatar: '🐶'
        },
        {
          id: '3',
          name: 'Mochi',
          breed: '波斯猫',
          summary: '新增好友意向，等待下次靠近确认。',
          meta: '今天 · 保持观察',
          avatar: '🐱'
        }
      ]
    },
    {
      key: 'match',
      label: '配对进展',
      items: [
        {
          id: '4',
          name: 'Coco',
          breed: '布偶猫',
          summary: '已完成首次靠近识别，等待双方再次接近确认。',
          meta: '刚刚 · 配对中',
          avatar: '🐱'
        },
        {
          id: '5',
          name: 'Rocky',
          breed: '柴犬',
          summary: '已交换基础标签，准备同步兴趣偏好。',
          meta: '18 分钟前 · 连接稳定',
          avatar: '🐕'
        }
      ]
    },
    {
      key: 'favorites',
      label: '重点关注',
      items: [
        {
          id: '6',
          name: 'Nana',
          breed: '萨摩耶',
          summary: '连续两天出现在附近，建议优先发起互动。',
          meta: '今天 · 高频出现',
          avatar: '🐶'
        },
        {
          id: '7',
          name: 'Toffee',
          breed: '金吉拉',
          summary: '情绪稳定，适合安排下一次碰碰配对。',
          meta: '昨天 · 情绪平稳',
          avatar: '🐱'
        }
      ]
    }
  ]
})

const activeInteractionTab = ref('nearby')
const interactionTouchStartX = ref(0)

const interactionTabs = computed(() => socialFeedResponse.value.tabs || [])
const activeInteractionIndex = computed(() =>
  interactionTabs.value.findIndex((tab) => tab.key === activeInteractionTab.value)
)
const activeInteractionItems = computed(
  () => interactionTabs.value[activeInteractionIndex.value]?.items || []
)

function selectInteractionTab(tabKey) {
  activeInteractionTab.value = tabKey
}

function switchInteractionTab(direction) {
  const nextIndex = activeInteractionIndex.value + direction
  if (nextIndex < 0 || nextIndex >= interactionTabs.value.length) return
  activeInteractionTab.value = interactionTabs.value[nextIndex].key
}

function handleInteractionTouchStart(event) {
  interactionTouchStartX.value = event.changedTouches[0]?.clientX || 0
}

function handleInteractionTouchEnd(event) {
  const endX = event.changedTouches[0]?.clientX || 0
  const deltaX = endX - interactionTouchStartX.value
  if (Math.abs(deltaX) < 40) return
  if (deltaX < 0) {
    switchInteractionTab(1)
    return
  }
  switchInteractionTab(-1)
}

const socialHistory = [
  { id: 'a', title: '与 Luna 在宠物公园完成互动', time: '今天 09:20', detail: '交换了基础社交标签与心情状态。' },
  { id: 'b', title: '与 Max 在寄养区短暂接触', time: '昨天 18:40', detail: '记录到一次友好靠近与同步行为。' },
  { id: 'c', title: '附近发现 Mochi', time: '昨天 15:10', detail: '已加入待确认列表，等待再次接近。' }
]

const syncStatus = computed(() => {
  if (loading.value) return 'loading'
  if (errorMessage.value) return 'error'
  return metricSections.value.length ? 'ready' : 'waiting'
})

onMounted(async () => {
  await Promise.all([refreshTelemetryBundle(), refreshEmotionBundle()])
  startTelemetryPolling()
  startEmotionPolling()
})
</script>

<template>
  <main class="dashboard-shell social-shell">
    <section class="social-hero social-card">
      <div class="hero-top">
        <div>
          <p class="eyebrow">Social</p>
          <h1>宠物社交</h1>
          <p class="lead">靠近附近伙伴，完成一次轻量配对，并回顾最近的互动记录。</p>
        </div>
        <span class="status-pill" :data-state="syncStatus">{{ statusText }}</span>
      </div>

      <article class="profile-strip">
        <div class="pet-avatar">{{ profile.avatar }}</div>
        <div class="pet-copy">
          <h2>{{ profile.name }}</h2>
          <p>{{ profile.breed }}</p>
        </div>
        <span class="mood-pill">{{ profile.mood }}</span>
      </article>

      <div class="meta-grid hero-meta-grid">
        <article v-for="item in heroHighlights" :key="item.label" class="meta-card social-card accent-card">
          <span class="meta-label">{{ item.label }}</span>
          <strong class="meta-value">{{ item.value }}</strong>
        </article>
      </div>

      <div class="hero-footer">
        <span class="status-hint">最近同步：{{ latestTelemetry.receivedAt || '--' }}</span>
        <button class="ghost-button inline-button" type="button" @click="showDebugPanel = !showDebugPanel">
          {{ showDebugPanel ? '收起调试信息' : '查看调试信息' }}
        </button>
      </div>

      <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
    </section>

    <section class="section-card scan-card">
      <div class="section-heading-row">
        <div>
          <p class="section-kicker">Nearby</p>
          <h2>附近宠物扫描</h2>
        </div>
        <span class="section-hint">优先展示可互动伙伴</span>
      </div>

      <div class="scan-stage">
        <div class="scan-radar">
          <div class="radar-ring ring-one"></div>
          <div class="radar-ring ring-two"></div>
          <div class="radar-ring ring-three"></div>
          <div class="scan-core"></div>
          <article
            v-for="pet in nearbyPets"
            :key="pet.id"
            class="nearby-marker"
            :style="pet.style"
          >
            <span class="marker-avatar">{{ pet.avatar }}</span>
            <strong>{{ pet.name }}</strong>
            <small>{{ pet.mood }}</small>
          </article>
        </div>
      </div>
    </section>

    <section class="section-card nfc-card">
      <div class="section-heading-row">
        <div>
          <p class="section-kicker">NFC</p>
          <h2>碰一碰即可连接</h2>
        </div>
        <span class="status-hint">{{ latestTelemetry.topic || '等待新的靠近事件' }}</span>
      </div>

      <div class="nfc-visual">
        <div class="collar-illustration left-collar"></div>
        <div class="nfc-center">
          <span class="nfc-icon">)))</span>
          <strong>NFC Connect</strong>
          <p>靠近另一只宠物项圈，快速建立一次社交互动。</p>
        </div>
        <div class="collar-illustration right-collar"></div>
      </div>

      <div class="action-row compact-action-row">
        <button class="primary-button" type="button" @click="refreshAll">刷新社交状态</button>
        <button class="ghost-button" type="button" @click="showDebugPanel = !showDebugPanel">
          {{ showDebugPanel ? '隐藏联调面板' : '展开联调面板' }}
        </button>
      </div>
    </section>

    <section class="section-card">
      <div class="section-heading-row recent-heading-row">
        <div>
          <p class="section-kicker">Recent</p>
          <h2>最近互动</h2>
        </div>
        <span class="section-hint">当前使用模拟数据，结构按后端返回形式组织</span>
      </div>

      <div class="interaction-tab-list" role="tablist" aria-label="最近互动分类">
        <button
          v-for="tab in interactionTabs"
          :key="tab.key"
          class="interaction-tab"
          :class="{ active: activeInteractionTab === tab.key }"
          type="button"
          role="tab"
          :aria-selected="activeInteractionTab === tab.key"
          @click="selectInteractionTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div
        class="interaction-panel"
        @touchstart="handleInteractionTouchStart"
        @touchend="handleInteractionTouchEnd"
      >
        <div class="interaction-panel-head">
          <span class="status-hint">数据源：{{ socialFeedResponse.source }}</span>
          <span class="status-hint">更新时间：{{ socialFeedResponse.updatedAt }}</span>
        </div>

        <div class="interaction-grid">
          <article v-for="item in activeInteractionItems" :key="item.id" class="interaction-card">
            <div class="interaction-header">
              <span class="mini-avatar">{{ item.avatar }}</span>
              <div>
                <h3>{{ item.name }}</h3>
                <p>{{ item.breed }}</p>
              </div>
            </div>
            <p class="interaction-summary">{{ item.summary }}</p>
            <span class="interaction-meta">{{ item.meta }}</span>
          </article>
        </div>

        <div class="interaction-switch-row">
          <button
            class="ghost-button switch-button"
            type="button"
            :disabled="activeInteractionIndex <= 0"
            @click="switchInteractionTab(-1)"
          >
            上一组
          </button>
          <div class="interaction-dots">
            <span
              v-for="tab in interactionTabs"
              :key="tab.key"
              class="interaction-dot"
              :class="{ active: activeInteractionTab === tab.key }"
            ></span>
          </div>
          <button
            class="ghost-button switch-button"
            type="button"
            :disabled="activeInteractionIndex >= interactionTabs.length - 1"
            @click="switchInteractionTab(1)"
          >
            下一组
          </button>
        </div>
      </div>
    </section>

    <section class="section-card history-card">
      <div class="section-heading-row">
        <div>
          <p class="section-kicker">History</p>
          <h2>社交记录</h2>
        </div>
      </div>

      <div class="history-list">
        <article v-for="item in socialHistory" :key="item.id" class="history-item">
          <span class="history-dot"></span>
          <div class="history-copy">
            <div class="history-row">
              <h3>{{ item.title }}</h3>
              <span>{{ item.time }}</span>
            </div>
            <p>{{ item.detail }}</p>
          </div>
        </article>
      </div>
    </section>

    <section v-if="showDebugPanel" class="section-card debug-panel">
      <div class="section-heading-row">
        <div>
          <p class="section-kicker">Debug</p>
          <h2>开发调试信息</h2>
        </div>
        <button class="ghost-button danger-button" type="button" @click="clearTelemetry">清空缓存</button>
      </div>

      <div class="meta-grid debug-meta-grid">
        <article v-for="item in sourceSummary" :key="item.label" class="meta-card">
          <span class="meta-label">{{ item.label }}</span>
          <strong class="meta-value">{{ item.value }}</strong>
        </article>
      </div>

      <div class="section-stack">
        <article v-for="section in metricSections" :key="section.key" class="section-panel">
          <div class="section-heading">
            <h3>{{ section.title }}</h3>
            <p>当前保留这部分数据，便于继续联调设备链路。</p>
          </div>

          <div class="sensor-grid">
            <article v-for="card in section.metrics" :key="card.key" class="sensor-card">
              <span class="card-label">{{ card.label }}</span>
              <div class="sensor-value">
                <strong>{{ card.value }}</strong>
                <span>{{ card.unit }}</span>
              </div>
              <p class="card-time">数据时间：{{ card.time || '--' }}</p>
            </article>
          </div>
        </article>
      </div>

      <div class="payload-panel">
        <div class="payload-header">
          <h3>原始 telemetry 数据</h3>
          <p>保留后端返回内容，便于后续社交能力联调。</p>
        </div>
        <pre>{{ rawPayloadText || '暂无原始数据。' }}</pre>
      </div>
    </section>
  </main>
</template>

<style scoped src="./DashboardView.css"></style>

