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
  refreshEmotionBundle,
  startEmotionPolling,
  stopEmotionPolling
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
  await refreshEmotionBundle()
  startEmotionPolling()
  await nextTick()
  initCharts()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  stopEmotionPolling()
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

<style scoped src="./EmotionView.css"></style>
