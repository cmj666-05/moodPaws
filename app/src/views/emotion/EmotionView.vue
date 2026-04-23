<script setup>
import { computed, onBeforeUnmount, onMounted } from "vue";
import { usePetApi } from "../../composables/usePetApi";

const {
  emotion,
  refreshEmotionBundle,
  startEmotionPolling,
  stopEmotionPolling,
} = usePetApi();

const emotionCatalog = [
  {
    key: "angry",
    label: "生气",
    mark: "气",
    brief: "需要一点距离",
    summary:
      "它可能被刺激到了，先减少打扰、降低噪声，给它一点安静空间会更合适。",
    accent: "#d97368",
    soft: "rgba(217, 115, 104, 0.14)",
    glow: "rgba(217, 115, 104, 0.22)",
    suggestions: [
      { label: "优先动作", value: "先减少打扰，给它留一点安静空间。" },
      { label: "互动方式", value: "暂时不要强行贴近，等它主动靠近更稳妥。" },
      { label: "环境调整", value: "把周围噪声和陌生刺激先降下来。" },
    ],
  },
  {
    key: "anxious",
    label: "焦虑",
    mark: "焦",
    brief: "需要稳定感",
    summary:
      "这更像是对环境变化的敏感反应。熟悉的陪伴、稳定的节奏和轻声安抚能帮它更快放松。",
    accent: "#e4a14e",
    soft: "rgba(228, 161, 78, 0.16)",
    glow: "rgba(228, 161, 78, 0.22)",
    suggestions: [
      { label: "优先动作", value: "用熟悉的声音陪它说话，先给稳定感。" },
      { label: "互动方式", value: "节奏放慢一点，避免突然触碰或催促。" },
      { label: "环境调整", value: "尽量保持熟悉的位置和日常作息。" },
    ],
  },
  {
    key: "happy",
    label: "开心",
    mark: "乐",
    brief: "状态轻松",
    summary: "整体情绪比较积极，现在适合互动、奖励，或者安排一点轻松活动。",
    accent: "#5da974",
    soft: "rgba(93, 169, 116, 0.16)",
    glow: "rgba(93, 169, 116, 0.22)",
    suggestions: [
      { label: "优先动作", value: "现在适合安排一点互动或轻松小游戏。" },
      { label: "互动方式", value: "可以配合夸奖和小奖励，强化好情绪。" },
      { label: "环境调整", value: "保持现在这份轻松节奏，不必突然加刺激。" },
    ],
  },
  {
    key: "lonely",
    label: "孤独",
    mark: "陪",
    brief: "等待回应",
    summary:
      "它更像是在等待陪伴或反馈，可以适当增加互动频率，让环境多一点回应感。",
    accent: "#6d9fc1",
    soft: "rgba(109, 159, 193, 0.16)",
    glow: "rgba(109, 159, 193, 0.22)",
    suggestions: [
      { label: "优先动作", value: "先给它一点回应，哪怕只是叫名字也有效。" },
      { label: "互动方式", value: "安排几分钟陪玩或贴近陪伴，会更有安全感。" },
      { label: "环境调整", value: "可以把熟悉的玩具、垫子放在它身边。" },
    ],
  },
  {
    key: "sad",
    label: "难过",
    mark: "抱",
    brief: "情绪偏低",
    summary: "现在更适合安静观察，减少刺激，再结合休息和食欲一起判断状态变化。",
    accent: "#8e82af",
    soft: "rgba(142, 130, 175, 0.16)",
    glow: "rgba(142, 130, 175, 0.22)",
    suggestions: [
      { label: "优先动作", value: "以安静陪伴为主，先不要安排高强度活动。" },
      { label: "互动方式", value: "靠近陪着它就好，不必频繁逗弄或催它回应。" },
      { label: "环境调整", value: "让休息区更安稳，光线和声音都柔和一点。" },
    ],
  },
];

const fallbackMood = {
  key: "unknown",
  label: "待识别",
  mark: "等",
  brief: "今日还没有新记录",
  summary: "先保持日常陪伴，新的情绪状态会在有足够信号后自动呈现。",
  accent: "#7d8a78",
  soft: "rgba(125, 138, 120, 0.14)",
  glow: "rgba(125, 138, 120, 0.2)",
  suggestions: [],
};

const moodMetaMap = new Map(emotionCatalog.map((item) => [item.label, item]));

const currentMood = computed(() =>
  typeof emotion.value.currentMood === "string"
    ? emotion.value.currentMood.trim()
    : "",
);
const hasMoodData = computed(() => Boolean(currentMood.value));
const currentMoodDisplay = computed(
  () => currentMood.value || "正在倾听它的情绪",
);
const currentMoodMeta = computed(
  () => moodMetaMap.get(currentMood.value) || fallbackMood,
);
const createdAtText = computed(() => formatTime(emotion.value.createdAt));
const heroSummary = computed(() =>
  hasMoodData.value ? currentMoodMeta.value.summary : fallbackMood.summary,
);

const aiSuggestions = computed(() => currentMoodMeta.value.suggestions || []);

const currentMoodOption = computed(() => ({
  ...currentMoodMeta.value,
  active: true,
}));

const heroTheme = computed(() => ({
  "--emotion-accent": currentMoodMeta.value.accent,
  "--emotion-soft": currentMoodMeta.value.soft,
  "--emotion-glow": currentMoodMeta.value.glow,
}));

onMounted(async () => {
  await refreshEmotionBundle();
  startEmotionPolling();
});

onBeforeUnmount(() => {
  stopEmotionPolling();
});

function formatTime(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "--";
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false });
}
</script>

<template>
  <main class="emotion-page">
    <section class="emotion-card" :style="heroTheme">
      <div class="card-top">
        <span class="card-kicker">情绪状态</span>
        <span class="sync-chip">{{
          createdAtText !== "--" ? "已更新" : "今日待观察"
        }}</span>
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
        <span v-if="createdAtText !== '--'" class="meta-chip"
          >更新于 {{ createdAtText }}</span
        >
      </div>

      <div class="state-strip">
        <article
          :key="currentMoodOption.key"
          class="state-pill"
          :class="{ 'state-pill-active': currentMoodOption.active }"
          :style="{
            '--mood-accent': currentMoodOption.accent,
            '--mood-soft': currentMoodOption.soft,
          }"
        >
          <span class="state-pill-mark">{{ currentMoodOption.mark }}</span>
          <span class="state-pill-text">
            <strong>{{ currentMoodOption.label }}</strong>
            <small>{{ currentMoodOption.brief }}</small>
          </span>
        </article>
      </div>
    </section>

    <section v-if="hasMoodData" class="summary-card">
      <div class="summary-head">
        <span class="card-kicker">AI 建议</span>
        <h2>现在更适合这样陪它</h2>
      </div>

      <div class="summary-grid">
        <div
          v-for="(item, index) in aiSuggestions"
          :key="`${item.label}-${index}`"
          class="summary-pill"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </section>

    <section v-else class="summary-card">
      <div class="summary-head">
        <span class="card-kicker">AI 建议</span>
        <h2>暂无情绪建议</h2>
      </div>
      <p class="empty-copy">等阿里云同步到新的情绪数据后，这里会显示对应建议。</p>
    </section>
  </main>
</template>

<style scoped src="./EmotionView.css"></style>
