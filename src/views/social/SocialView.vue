<script setup>
import { ref } from 'vue'

// 宠舍列表数据
const boardingHouses = ref([
  {
    id: 1,
    name: 'Cozy Paw Boarding House',
    buddy: 'Buddy - Golden Retriever',
    avatar: '🐕',
    notificationCount: 1,
    environment: {
      temperature: { value: 24, status: 'Ideal', unit: '°C' },
      humidity: { value: 50, unit: '%' },
      airQuality: 'Good'
    },
    liveView: {
      hasVideo: true,
      status: 'VIDEO'
    },
    vitalSigns: {
      heartRate: { value: 78, unit: 'BPM', status: 'Normal' },
      caloriesBurned: 1557
    },
    appetite: {
      foodIntake: 75,
      waterConsumption: 60
    },
    emotion: {
      primary: 'Happy',
      secondary: 'Playful'
    }
  }
])

const selectedHouse = ref(boardingHouses.value[0])
</script>

<template>
  <div class="social-view">
    <!-- 宠舍卡片 -->
    <section class="boarding-card">
      <div class="card-header">
        <div class="header-top">
          <div class="dog-avatar-container">
            <div class="dog-avatar">{{ selectedHouse.avatar }}</div>
          </div>
          <div class="boarding-info">
            <div class="house-name">{{ selectedHouse.name }}</div>
            <div class="buddy-info">
              <span class="status-dot"></span>{{ selectedHouse.buddy }}
            </div>
          </div>
          <div class="notification-bell">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span v-if="selectedHouse.notificationCount" class="badge">{{ selectedHouse.notificationCount }}</span>
          </div>
        </div>
      </div>

      <!-- 环境监测 -->
      <div class="section">
        <h3 class="section-title">环境</h3>
        <div class="env-grid">
          <div class="env-card temperature">
            <div class="env-label">温度</div>
            <div class="env-value">{{ selectedHouse.environment.temperature.value }}°C</div>
            <div class="env-status">{{ selectedHouse.environment.temperature.status }}</div>
            <div class="env-slider">
              <span class="slider-btn minus">−</span>
              <div class="slider-bar"></div>
              <span class="slider-btn plus">+</span>
            </div>
          </div>

          <div class="env-card humidity">
            <div class="env-label">湿度</div>
            <div class="env-value">{{ selectedHouse.environment.humidity.value }}%</div>
            <div class="env-slider">
              <div class="slider-bar"></div>
            </div>
          </div>

          <div class="env-card air-quality">
            <div class="env-label">空气质量</div>
            <div class="env-value">{{ selectedHouse.environment.airQuality }}</div>
          </div>
        </div>
      </div>

      <!-- 实时监控 -->
      <div class="section">
        <h3 class="section-title">实时监控</h3>
        <div class="live-view">
          <div class="video-placeholder">
            <span class="video-icon">📹</span>
            <span class="video-badge">{{ selectedHouse.liveView.status }}</span>
          </div>
        </div>
      </div>

      <!-- 实时生命体征 - 右侧布局 -->
      <div class="vital-section">
        <h3 class="section-title">实时生命体征</h3>
        <div class="vital-grid">
          <div class="vital-card heart-rate">
            <div class="vital-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12h18M3 12l3-3m0 6l-3-3m18 0l-3 3m0-6l3 3" />
              </svg>
            </div>
            <div class="vital-info">
              <div class="vital-label">心率</div>
              <div class="vital-value">{{ selectedHouse.vitalSigns.heartRate.value }} <span class="vital-unit">BPM</span></div>
              <div class="vital-status">{{ selectedHouse.vitalSigns.heartRate.status }}</div>
            </div>
          </div>

          <div class="vital-card calories">
            <div class="vital-icon">🔥</div>
            <div class="vital-info">
              <div class="vital-label">消耗卡路里</div>
              <div class="vital-value">{{ selectedHouse.vitalSigns.caloriesBurned }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 食欲与健康管理 -->
      <div class="section">
        <h3 class="section-title">食欲与健康管理</h3>
        <div class="appetite-section">
          <div class="appetite-item">
            <div class="appetite-label">食物摄入</div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: selectedHouse.appetite.foodIntake + '%' }"></div>
            </div>
          </div>
          <div class="appetite-item">
            <div class="appetite-label">水分摄入</div>
            <div class="progress-bar">
              <div class="progress-fill water" :style="{ width: selectedHouse.appetite.waterConsumption + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 情绪反馈 -->
      <div class="section">
        <h3 class="section-title">情绪反馈</h3>
        <div class="emotion-badges">
          <div class="emotion-badge happy">{{ selectedHouse.emotion.primary }}</div>
          <div class="emotion-badge playful">{{ selectedHouse.emotion.secondary }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.social-view {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-bg);
  padding-bottom: calc(var(--tab-height) + var(--safe-bottom));
}

/* 宠舍卡片 */
.boarding-card {
  background: var(--color-surface-strong);
  padding: 20px;
  margin: 16px 20px;
  border-radius: var(--radius);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.card-header {
  margin-bottom: 20px;
  background: linear-gradient(180deg, rgba(150, 200, 240, 0.25) 0%, transparent 100%);
  margin: -20px -20px 20px -20px;
  padding: 20px 20px;
  border-radius: var(--radius) var(--radius) 0 0;
  position: relative;
}

.dog-avatar-container {
  margin-right: 12px;
  flex-shrink: 0;
}

.dog-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #d4a574 0%, #c89a6c 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.boarding-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.house-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
}

.buddy-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
  display: inline-block;
  flex-shrink: 0;
}

.notification-bell {
  position: relative;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text);
  cursor: pointer;
}

.notification-bell svg {
  width: 20px;
  height: 20px;
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  background: var(--color-danger);
  color: white;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 章节 */
.section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

/* 环境卡片 */
.env-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

.env-card {
  background: var(--color-surface-muted);
  padding: 12px;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.env-card.temperature {
  background: rgba(76, 175, 80, 0.12);
}

.env-card.humidity {
  background: var(--color-surface-muted);
}

.env-card.air-quality {
  background: var(--color-surface-muted);
}

.env-label {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.env-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 2px;
}

.env-status {
  font-size: 11px;
  color: var(--color-success);
  margin-bottom: 8px;
}

.env-slider {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.slider-btn {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  border: none;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.slider-bar {
  flex: 1;
  height: 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  position: relative;
}

.slider-bar::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  background: var(--color-primary);
  border-radius: 50%;
  top: 50%;
  left: 60%;
  transform: translate(-50%, -50%);
}

/* 实时监控 */
.live-view {
  width: 100%;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-surface-muted);
}

.video-placeholder {
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, #d4a574 0%, #c89a6c 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-direction: column;
  gap: 8px;
}

.video-icon {
  font-size: 36px;
}

.video-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

/* 生命体征 */
.vital-section {
  margin-bottom: 20px;
}

.vital-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vital-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(76, 175, 80, 0.12);
  border-radius: var(--radius-sm);
}

.vital-card.calories {
  background: rgba(255, 152, 0, 0.12);
}

.vital-icon {
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.vital-icon svg {
  width: 20px;
  height: 20px;
  color: var(--color-primary);
}

.vital-info {
  flex: 1;
}

.vital-label {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 2px;
}

.vital-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.vital-unit {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-secondary);
}

.vital-status {
  font-size: 11px;
  color: var(--color-success);
}

/* 食欲管理 */
.appetite-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.appetite-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.appetite-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-success);
  border-radius: 4px;
  transition: width 0.3s;
}

.progress-fill.water {
  background: #2196F3;
}

/* 情绪反馈 */
.emotion-badges {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.emotion-badge {
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  display: inline-block;
}

.emotion-badge.happy {
  background: rgba(255, 193, 7, 0.2);
  color: #F57F17;
}

.emotion-badge.playful {
  background: rgba(233, 30, 99, 0.2);
  color: #C2185B;
}
</style>
