<script setup>
import { computed, onBeforeUnmount, onMounted } from "vue";
import { usePetApi } from "../../composables/usePetApi";

const {
  emotion,
  refreshEmotionBundle,
  startEmotionPolling,
  stopEmotionPolling,
} = usePetApi();

const petPhotoUrl =
  "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=320&q=80";

const emotionCatalog = [
  {
    key: "angry",
    label: "生气",
    mark: "!",
    brief: "需要一点距离",
    summary:
      "整体情绪偏紧绷，先减少打扰、降低噪声，给它留一点安静空间会更合适。",
    accent: "#d97368",
    soft: "rgba(217, 115, 104, 0.14)",
    glow: "rgba(217, 115, 104, 0.22)",
    suggestions: [
      { label: "优先动作", value: "先减少打扰，给它一点冷静缓冲时间。", icon: "heart" },
      { label: "互动方式", value: "不要立刻强贴近，等它主动靠近会更稳。", icon: "gift" },
      { label: "环境调整", value: "把周围噪声和陌生刺激先降下来。", icon: "leaf" },
      { label: "观察重点", value: "留意它是否持续紧绷，避免情绪继续升级。", icon: "spark" },
    ],
  },
  {
    key: "anxious",
    label: "焦虑",
    mark: "?",
    brief: "需要稳定感",
    summary:
      "这更像是对环境变化的敏感反应。熟悉的陪伴、稳定节奏和轻声安抚会更有效。",
    accent: "#e4a14e",
    soft: "rgba(228, 161, 78, 0.16)",
    glow: "rgba(228, 161, 78, 0.22)",
    suggestions: [
      { label: "优先动作", value: "先用熟悉声音安抚它，给它稳定感。", icon: "heart" },
      { label: "互动方式", value: "放慢动作，避免突然触碰或催促。", icon: "gift" },
      { label: "环境调整", value: "尽量保持熟悉位置和日常节奏。", icon: "leaf" },
      { label: "观察重点", value: "注意它是否在新环境和陌生声音下更紧张。", icon: "spark" },
    ],
  },
  {
    key: "happy",
    label: "开心",
    mark: "♪",
    brief: "状态轻松",
    summary:
      "整体情绪比较积极，现在适合互动、奖励，或者安排一点轻松活动。",
    accent: "#5da974",
    soft: "rgba(93, 169, 116, 0.16)",
    glow: "rgba(93, 169, 116, 0.22)",
    suggestions: [
      { label: "优先动作", value: "现在适合安排一点互动或轻松小游戏。", icon: "heart" },
      { label: "互动方式", value: "可以配合夸奖和小奖励，强化好情绪。", icon: "gift" },
      { label: "环境调整", value: "保持现在这份轻松节奏，不必突然加刺激。", icon: "leaf" },
      { label: "观察重点", value: "趁状态不错，记录它最喜欢的互动方式。", icon: "spark" },
    ],
  },
  {
    key: "lonely",
    label: "孤独",
    mark: ".",
    brief: "等待回应",
    summary:
      "它更像是在等反馈和陪伴，适当增加互动频率，通常比单纯放着更有效。",
    accent: "#6d9fc1",
    soft: "rgba(109, 159, 193, 0.16)",
    glow: "rgba(109, 159, 193, 0.22)",
    suggestions: [
      { label: "优先动作", value: "先给一点明确回应，叫名字也会有帮助。", icon: "heart" },
      { label: "互动方式", value: "安排几分钟陪玩或贴近陪伴。", icon: "gift" },
      { label: "环境调整", value: "把熟悉玩具和垫子放在它身边。", icon: "leaf" },
      { label: "观察重点", value: "如果长时间独处，可以增加一点陪伴感。", icon: "spark" },
    ],
  },
  {
    key: "sad",
    label: "难过",
    mark: "~",
    brief: "情绪偏低",
    summary:
      "现在更适合安静观察，减少刺激，再结合休息和食欲一起判断状态变化。",
    accent: "#8e82af",
    soft: "rgba(142, 130, 175, 0.16)",
    glow: "rgba(142, 130, 175, 0.22)",
    suggestions: [
      { label: "优先动作", value: "以安静陪伴为主，先不安排高强度活动。", icon: "heart" },
      { label: "互动方式", value: "靠近陪着它就好，不必频繁逗弄。", icon: "gift" },
      { label: "环境调整", value: "让休息区更安静，光线和声音都柔和一点。", icon: "leaf" },
      { label: "观察重点", value: "留意休息、进食和精神状态是否一起变化。", icon: "spark" },
    ],
  },
];

const fallbackMood = emotionCatalog.find((item) => item.key === "happy");

const moodMetaMap = new Map();
emotionCatalog.forEach((item) => {
  moodMetaMap.set(item.key, item);
  moodMetaMap.set(item.label, item);
  moodMetaMap.set(item.key.toLowerCase(), item);
});

const currentMood = computed(() =>
  typeof emotion.value.currentMood === "string"
    ? emotion.value.currentMood.trim()
    : "",
);

const currentMoodMeta = computed(() => {
  const rawValue = currentMood.value;
  if (!rawValue) return fallbackMood;
  return (
    moodMetaMap.get(rawValue) ||
    moodMetaMap.get(rawValue.toLowerCase()) ||
    fallbackMood
  );
});

const currentMoodDisplay = computed(() => currentMoodMeta.value.label);
const createdAtText = computed(() => formatTime(emotion.value.createdAt));
const statusText = computed(() =>
  createdAtText.value !== "--" ? "已更新" : "今日待观察",
);
const heroSummary = computed(() =>
  typeof emotion.value.summary === "string" && emotion.value.summary.trim()
    ? emotion.value.summary.trim()
    : currentMoodMeta.value.summary,
);
const aiSuggestions = computed(() =>
  Array.isArray(emotion.value.suggestions) && emotion.value.suggestions.length
    ? emotion.value.suggestions
    : currentMoodMeta.value.suggestions || [],
);

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
  const date = new Date(parsed);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}:${ss}`;
}
</script>

<template>
  <main class="emotion-page">
    <section class="emotion-card" :style="heroTheme">
      <div class="card-top">
        <span class="card-kicker">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 20.2s-6.8-4.4-6.8-9.1A3.9 3.9 0 0 1 9.2 7c1.2 0 2.2.5 2.8 1.4A3.6 3.6 0 0 1 14.8 7a3.9 3.9 0 0 1 4 4.1c0 4.7-6.8 9.1-6.8 9.1Z"
              fill="none"
              stroke="currentColor"
              stroke-linejoin="round"
              stroke-width="1.8"
            />
          </svg>
          情绪状态
        </span>

        <span class="sync-chip">
          {{ statusText }}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M20 12a8 8 0 1 1-2.34-5.66"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="1.8"
            />
            <path
              d="M20 4v5h-5"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.8"
            />
          </svg>
        </span>
      </div>

      <div class="hero-layout">
        <div class="hero-copy">
          <h1>
            {{ currentMoodDisplay }}
            <span class="title-accent" aria-hidden="true">✦</span>
          </h1>
          <p class="hero-brief">{{ currentMoodMeta.brief }}</p>
          <p class="hero-summary">{{ heroSummary }}</p>
        </div>

        <div class="hero-photo-wrap" aria-hidden="true">
          <div class="hero-photo-frame">
            <img
              class="pet-avatar-photo"
              :src="petPhotoUrl"
              alt="Lucky 的头像"
            />
          </div>

          <div class="hero-float-badge">
            <svg viewBox="0 0 24 24">
              <path
                d="M9 18V7.2c0-1 .8-1.8 1.8-1.8h5.4"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <path
                d="M16.2 5.4v8.6"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-width="1.8"
              />
              <circle cx="7.4" cy="18" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8" />
              <circle cx="16.2" cy="16.2" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8" />
            </svg>
          </div>
        </div>
      </div>



      <article class="state-pill">
        <span class="state-pill-mark">{{ currentMoodMeta.mark }}</span>
        <span class="state-pill-text">
          <strong>{{ currentMoodDisplay }}</strong>
          <small>{{ currentMoodMeta.brief }}</small>
        </span>
      </article>
    </section>

    <section class="summary-card">
      <div class="summary-head">
        <span class="summary-kicker">AI 建议</span>
        <h2>现在更适合这样陪它</h2>
        <div class="summary-deco" aria-hidden="true">
          <span class="summary-line"></span>
          <svg viewBox="0 0 24 24">
            <path
              d="M12 20.2s-6.8-4.4-6.8-9.1A3.9 3.9 0 0 1 9.2 7c1.2 0 2.2.5 2.8 1.4A3.6 3.6 0 0 1 14.8 7a3.9 3.9 0 0 1 4 4.1c0 4.7-6.8 9.1-6.8 9.1Z"
              fill="none"
              stroke="currentColor"
              stroke-linejoin="round"
              stroke-width="1.6"
            />
          </svg>
        </div>
      </div>

      <div class="summary-grid">
        <article
          v-for="(item, index) in aiSuggestions"
          :key="`${item.label}-${index}`"
          class="summary-pill"
        >
          <span class="summary-icon" :class="`summary-icon-${item.icon}`">
            <svg v-if="item.icon === 'heart'" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 20.2s-6.8-4.4-6.8-9.1A3.9 3.9 0 0 1 9.2 7c1.2 0 2.2.5 2.8 1.4A3.6 3.6 0 0 1 14.8 7a3.9 3.9 0 0 1 4 4.1c0 4.7-6.8 9.1-6.8 9.1Z"
                fill="none"
                stroke="currentColor"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>

            <svg v-else-if="item.icon === 'gift'" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4.5 10.2h15v9a1.8 1.8 0 0 1-1.8 1.8H6.3a1.8 1.8 0 0 1-1.8-1.8z"
                fill="none"
                stroke="currentColor"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <path
                d="M3.5 10.2h17v-3a1.2 1.2 0 0 0-1.2-1.2H4.7a1.2 1.2 0 0 0-1.2 1.2zM12 6v15M9.3 6c-1.5 0-2.8-.8-2.8-2.1S7.4 1.8 9 1.8c1.2 0 2.3.8 3 2.5C12.7 2.6 13.8 1.8 15 1.8c1.6 0 2.5.9 2.5 2.1S16.2 6 14.7 6"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>

            <svg v-else-if="item.icon === 'spark'" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="m12 3 1.7 4.8L18.5 9l-4.8 1.2L12 15l-1.7-4.8L5.5 9l4.8-1.2z"
                fill="none"
                stroke="currentColor"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>

            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M19 5c-5.2 0-9.9 3.6-11 9.2-.4 2-.3 4 .2 5.8 4-.7 7.5-2.6 9.8-5.6C20 11.9 20.4 8.4 19 5Z"
                fill="none"
                stroke="currentColor"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
              <path
                d="M6.8 19.2 17 8.8"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-width="1.8"
              />
            </svg>
          </span>

          <span class="summary-copy">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </span>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped src="./EmotionView.css"></style>
