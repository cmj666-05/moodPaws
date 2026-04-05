<script setup>
import * as echarts from 'echarts/core'
import { BarChart, GaugeChart, LineChart } from 'echarts/charts'
import { GraphicComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePetApi } from '../../composables/usePetApi'

echarts.use([GaugeChart, BarChart, LineChart, GridComponent, GraphicComponent, CanvasRenderer])

const carouselRef = ref(null)
const activeSlide = ref(0)
const gaugeChartEl = ref(null)
const voiceChartEl = ref(null)
const fluctuationChartEl = ref(null)

const {
  loading,
  errorMessage,
  emotion,
  refreshEmotion,
  startPolling,
  stopPolling
} = usePetApi()

const petProfile = {
  name: 'Lucky',
  breed: '金毛寻回犬',
  age: '3 岁'
}

const currentMood = computed(() => emotion.value.currentMood || '开心')
const emotionScore = computed(() => Number(emotion.value.score) || 0)
const voiceFrequency = computed(() => emotion.value.voice?.frequency || [])
const voiceTone = computed(() => emotion.value.voice?.tone || [])
const fluctuationTimeline = computed(() => emotion.value.fluctuation?.timeline || [])
const fluctuationMetrics = computed(() => emotion.value.fluctuation?.values || [])
const moodHistory = computed(() => emotion.value.history || [])

const analysisSlides = [
  { key: 'voice', title: '声线分析', subtitle: '频率与音调趋势' },
  { key: 'posture', title: '姿态识别', subtitle: '查看全天情绪波动趋势' }
]

let gaugeChart = null
let voiceChart = null
let fluctuationChart = null

function getVoiceCategories() {
  const size = Math.max(voiceFrequency.value.length, voiceTone.value.length, 1)
  return Array.from({ length: size }, (_, index) => `${index + 1}`)
}

function buildGaugeOption() {
  return {
    animation: false,
    series: [
      {
        type: 'gauge',
        center: ['50%', '66%'],
        radius: '100%',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        pointer: {
          show: true,
          icon: 'path://M6 0 L0 100 L12 100 Z',
          length: '58%',
          width: 10,
          offsetCenter: [0, '-6%'],
          itemStyle: { color: '#3f7082' }
        },
        anchor: {
          show: true,
          size: 18,
          itemStyle: {
            color: '#3f7082',
            borderColor: '#ffffff',
            borderWidth: 4
          }
        },
        progress: { show: false },
        axisLine: {
          roundCap: true,
          lineStyle: {
            width: 22,
            color: [
              [0.34, '#d9e1ec'],
              [0.67, '#9fddae'],
              [1, '#56c987']
            ]
          }
        },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        detail: { show: false },
        title: { show: false },
        data: [{ value: emotionScore.value }]
      }
    ]
  }
}

function buildVoiceOption() {
  const categories = getVoiceCategories()
  return {
    animation: false,
    grid: [
      { left: 12, right: 12, top: 34, height: 70 },
      { left: 12, right: 12, top: 154, height: 70 }
    ],
    xAxis: [
      {
        type: 'category',
        data: categories,
        gridIndex: 0,
        boundaryGap: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false }
      },
      {
        type: 'category',
        data: categories,
        gridIndex: 1,
        boundaryGap: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#7b8aa0',
          fontSize: 12,
          margin: 14,
          formatter(value, index) {
            if (index === 0) return '低频'
            if (index === categories.length - 1) return '高频'
            return ''
          }
        }
      }
    ],
    yAxis: [
      { type: 'value', gridIndex: 0, max: 28, show: false },
      { type: 'value', gridIndex: 1, max: 28, show: false }
    ],
    graphic: [
      {
        type: 'text',
        left: 10,
        top: 6,
        style: {
          text: '频率',
          fill: '#1f2933',
          fontSize: 16,
          fontWeight: 600
        }
      },
      {
        type: 'text',
        left: 10,
        top: 126,
        style: {
          text: '音调',
          fill: '#1f2933',
          fontSize: 16,
          fontWeight: 600
        }
      }
    ],
    series: [
      {
        type: 'bar',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: voiceFrequency.value,
        barWidth: '68%',
        itemStyle: {
          borderRadius: [999, 999, 999, 999],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#2f677e' },
            { offset: 1, color: '#67c691' }
          ])
        }
      },
      {
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: voiceTone.value,
        barWidth: '68%',
        itemStyle: {
          borderRadius: [999, 999, 999, 999],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#9adfba' },
            { offset: 1, color: '#d9ece1' }
          ])
        }
      }
    ]
  }
}

function buildFluctuationOption() {
  return {
    animation: false,
    grid: { left: 8, right: 8, top: 8, bottom: 30 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: fluctuationTimeline.value,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#8b95a7',
        fontSize: 11,
        interval: 0,
        margin: 10
      }
    },
    yAxis: {
      type: 'value',
      min: 20,
      max: 80,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: {
        lineStyle: {
          color: ['rgba(120, 136, 158, 0.1)']
        }
      }
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        data: fluctuationMetrics.value,
        lineStyle: {
          width: 2.5,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#c5a353' },
            { offset: 1, color: '#7ab6d3' }
          ])
        },
        itemStyle: {
          color(params) {
            return params.dataIndex < 3 ? '#c5a353' : '#7ab6d3'
          },
          borderWidth: 2,
          borderColor: '#ffffff'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(122, 182, 211, 0.18)' },
            { offset: 1, color: 'rgba(122, 182, 211, 0)' }
          ])
        }
      }
    ]
  }
}

function updateCharts() {
  if (gaugeChart) gaugeChart.setOption(buildGaugeOption())
  if (voiceChart) voiceChart.setOption(buildVoiceOption())
  if (fluctuationChart) fluctuationChart.setOption(buildFluctuationOption())
}

function initCharts() {
  if (gaugeChartEl.value && !gaugeChart) {
    gaugeChart = echarts.init(gaugeChartEl.value)
  }
  if (voiceChartEl.value && !voiceChart) {
    voiceChart = echarts.init(voiceChartEl.value)
  }
  if (fluctuationChartEl.value && !fluctuationChart) {
    fluctuationChart = echarts.init(fluctuationChartEl.value)
  }
  updateCharts()
}

function handleResize() {
  gaugeChart?.resize()
  voiceChart?.resize()
  fluctuationChart?.resize()
}

function destroyCharts() {
  gaugeChart?.dispose()
  voiceChart?.dispose()
  fluctuationChart?.dispose()
  gaugeChart = null
  voiceChart = null
  fluctuationChart = null
}

function handleCarouselScroll(event) {
  const container = event.target
  const index = Math.round(container.scrollLeft / container.clientWidth)
  activeSlide.value = Math.max(0, Math.min(analysisSlides.length - 1, index))
}

function setActiveSlide(index) {
  activeSlide.value = index
  if (!carouselRef.value) return
  carouselRef.value.scrollTo({
    left: carouselRef.value.clientWidth * index,
    behavior: 'smooth'
  })
}

watch(
  emotion,
  () => {
    if (gaugeChart || voiceChart || fluctuationChart) {
      updateCharts()
    }
  },
  { deep: true }
)

onMounted(async () => {
  await refreshEmotion()
  startPolling()
  await nextTick()
  initCharts()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  stopPolling()
  window.removeEventListener('resize', handleResize)
  destroyCharts()
})
</script>

<template>
  <main class="emotion-page">
    <section class="summary-panel">
      <article class="hero-card">
        <div class="hero-header">
          <div class="avatar">L</div>
          <div class="hero-copy">
            <span class="eyebrow">情绪感知</span>
            <h1>{{ petProfile.name }}</h1>
            <p>{{ petProfile.breed }} · {{ petProfile.age }}</p>
          </div>
          <span class="mood-pill">{{ currentMood }}</span>
        </div>

        <div class="gauge-wrap">
          <div ref="gaugeChartEl" class="gauge-chart"></div>
          <span class="gauge-label gauge-label-left">压力</span>
          <span class="gauge-label gauge-label-center">平静</span>
          <span class="gauge-label gauge-label-right">愉悦</span>

          <div class="gauge-center-face">
            <span class="pet-head"></span>
            <span class="pet-ear pet-ear-left"></span>
            <span class="pet-ear pet-ear-right"></span>
            <span class="pet-eye pet-eye-left"></span>
            <span class="pet-eye pet-eye-right"></span>
            <span class="pet-snout"></span>
            <span class="pet-nose"></span>
            <span class="pet-mouth"></span>
          </div>
        </div>

        <p class="emotion-current">{{ currentMood }}</p>
        <p v-if="loading" class="emotion-status">情绪数据刷新中</p>
        <p v-else-if="errorMessage" class="emotion-status error">{{ errorMessage }}</p>
      </article>
    </section>

    <section class="analysis-section">
      <div ref="carouselRef" class="analysis-carousel" @scroll.passive="handleCarouselScroll">
        <article class="analysis-card">
          <div class="card-head">
            <div>
              <h2>{{ analysisSlides[0].title }}</h2>
              <p>{{ analysisSlides[0].subtitle }}</p>
            </div>
          </div>
          <div ref="voiceChartEl" class="voice-chart"></div>
        </article>

        <article class="analysis-card">
          <div class="card-head">
            <div>
              <h2>{{ analysisSlides[1].title }}</h2>
              <p>{{ analysisSlides[1].subtitle }}</p>
            </div>
            <span class="time-pill">全天</span>
          </div>

          <div class="trend-card">
            <div class="trend-title">
              <h3>情绪波动</h3>
            </div>
            <div class="fluctuation-wrap">
              <div ref="fluctuationChartEl" class="fluctuation-chart"></div>
              <div class="curve-axis-labels">
                <span>愉悦</span>
                <span>焦虑</span>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div class="carousel-dots">
        <button
          v-for="(slide, index) in analysisSlides"
          :key="slide.key"
          class="dot"
          :class="{ active: activeSlide === index }"
          type="button"
          :aria-label="`切换到${slide.title}`"
          @click="setActiveSlide(index)"
        ></button>
      </div>
    </section>

    <section class="history-card">
      <div class="history-head">
        <h2>情绪摘要</h2>
        <span>最近一天</span>
      </div>
      <div class="history-list">
        <div v-for="item in moodHistory" :key="item.label" class="history-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
        <div v-if="!moodHistory.length" class="history-empty">暂无情绪摘要</div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.emotion-page {
  max-width: var(--page-max-width);
  margin: 0 auto;
  padding: calc(env(safe-area-inset-top, 0px) + 18px) 16px calc(var(--tab-height) + var(--safe-bottom) + 38px);
}

.hero-card,
.analysis-card,
.history-card,
.trend-card {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--color-shadow);
}

.hero-card {
  border-radius: 18px;
  padding: 14px 16px 16px;
}

.hero-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--color-surface-muted);
  color: #7a6652;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
}

.hero-copy {
  flex: 1;
}

.eyebrow {
  display: inline-block;
  margin-bottom: 4px;
  color: var(--color-text-muted);
  font-size: 11px;
}

.hero-copy h1 {
  font-size: 24px;
  line-height: 1.1;
  margin-bottom: 2px;
}

.hero-copy p {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.mood-pill,
.time-pill {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(86, 182, 127, 0.11);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
}

.gauge-wrap {
  position: relative;
  margin-top: 8px;
}

.gauge-chart {
  height: 314px;
  margin: 0 auto -6px;
}

.gauge-label {
  position: absolute;
  color: #6f7c8c;
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
  pointer-events: none;
}

.gauge-label-left {
  left: 30px;
  top: 170px;
}

.gauge-label-center {
  left: 50%;
  top: 34px;
  transform: translateX(-50%);
}

.gauge-label-right {
  right: 30px;
  top: 170px;
}

.gauge-center-face {
  position: absolute;
  left: 50%;
  top: 146px;
  width: 128px;
  height: 128px;
  border-radius: 50%;
  transform: translateX(-50%);
  background: radial-gradient(circle at 50% 34%, #f8f2e7, #f3eadc 76%);
  pointer-events: none;
}

.pet-head {
  position: absolute;
  left: 50%;
  top: 38px;
  width: 74px;
  height: 72px;
  border-radius: 50% 50% 46% 46%;
  background: #e4bd81;
  border: 3px solid #846243;
  transform: translateX(-50%);
}

.pet-ear {
  position: absolute;
  top: 46px;
  width: 18px;
  height: 22px;
  border-radius: 50%;
  background: #c69766;
  border: 3px solid #846243;
}

.pet-ear-left {
  left: 30px;
  transform: rotate(-20deg);
}

.pet-ear-right {
  right: 30px;
  transform: rotate(20deg);
}

.pet-eye {
  position: absolute;
  top: 78px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #735233;
}

.pet-eye-left {
  left: 54px;
}

.pet-eye-right {
  right: 54px;
}

.pet-snout {
  position: absolute;
  left: 50%;
  top: 92px;
  width: 28px;
  height: 18px;
  border-radius: 50%;
  background: #f0d7b2;
  transform: translateX(-50%);
}

.pet-nose {
  position: absolute;
  left: 50%;
  top: 94px;
  width: 9px;
  height: 7px;
  border-radius: 50%;
  background: #735233;
  transform: translateX(-50%);
}

.pet-mouth {
  position: absolute;
  left: 50%;
  top: 102px;
  width: 28px;
  height: 12px;
  border-bottom: 3px solid #735233;
  border-radius: 0 0 16px 16px;
  transform: translateX(-50%);
}

.emotion-current {
  margin-top: -6px;
  text-align: center;
  font-size: 27px;
  font-weight: 700;
}

.emotion-status {
  margin-top: 8px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.emotion-status.error {
  color: #b8534d;
}

.analysis-carousel {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.analysis-carousel::-webkit-scrollbar {
  display: none;
}

.analysis-card {
  min-width: calc(100vw - 32px);
  border-radius: 18px;
  padding: 15px 14px 14px;
  scroll-snap-align: start;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.card-head h2 {
  font-size: 19px;
  margin-bottom: 2px;
}

.card-head p {
  color: var(--color-text-secondary);
}

.voice-chart {
  height: 234px;
  border-radius: 14px;
  border: 1px solid var(--color-divider);
  background: var(--color-surface-muted);
}

.trend-card {
  border-radius: 14px;
  padding: 12px;
}

.trend-title h3 {
  font-size: 16px;
  margin-bottom: 8px;
}

.fluctuation-chart {
  height: 116px;
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(122, 182, 211, 0.08) 0%, rgba(122, 182, 211, 0.03) 48%, rgba(197, 163, 83, 0.06) 48%, rgba(197, 163, 83, 0.08) 100%);
}

.fluctuation-wrap {
  position: relative;
  padding-right: 34px;
}

.curve-axis-labels {
  position: absolute;
  top: 6px;
  right: 0;
  bottom: 6px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: var(--color-text-secondary);
  font-size: 12px;
  text-align: right;
}

.carousel-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(139, 149, 167, 0.35);
}

.dot.active {
  width: 22px;
  background: var(--color-primary);
}

.history-card {
  border-radius: 18px;
 
  padding: 18px 16px;
}

.history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.history-head h2 {
  font-size: 20px;
}

.history-head span {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.history-list {
  display: grid;
  gap: 12px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-divider);
}

.history-empty {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}

.history-item span {
  color: var(--color-text-secondary);
}

.history-item strong {
  font-size: 16px;
}

@media (min-width: 768px) {
  .emotion-page {
    max-width: var(--page-max-width);
  }

  .analysis-card {
    min-width: calc(var(--page-max-width) - 32px);
  }
}

@media (max-width: 390px) {
  .gauge-chart {
    height: 298px;
  }

  .gauge-label-left {
    left: 18px;
    top: 164px;
  }

  .gauge-label-right {
    right: 18px;
    top: 164px;
  }

  .gauge-center-face {
    top: 140px;
    width: 120px;
    height: 120px;
  }

  .emotion-current {
    font-size: 24px;
  }
}
</style>
