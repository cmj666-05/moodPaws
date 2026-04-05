<script setup>
import { onMounted } from 'vue'
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
  startPolling
} = usePetApi()

onMounted(async () => {
  await refreshAll()
  startPolling()
})
</script>

<template>
  <main class="dashboard-shell">
    <section class="hero-panel">
      <p class="eyebrow">MoodPaws Server API</p>
      <h1>PetHouse + Collar</h1>
      <p class="lead">
        Dashboard data is now served by
        <code>moodpaws-server</code>. Current topic:
        <code>{{ latestTelemetry.topic || '--' }}</code>
      </p>

      <div class="status-row">
        <span class="status-pill" :data-state="loading ? 'loading' : errorMessage ? 'error' : 'ready'">
          {{ statusText }}
        </span>
        <span class="status-hint">Received At: {{ latestTelemetry.receivedAt || '--' }}</span>
      </div>

      <div class="action-row">
        <button class="primary-button" type="button" @click="refreshAll">
          Refresh
        </button>
        <button class="ghost-button" type="button" @click="clearTelemetry">
          Clear
        </button>
      </div>

      <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
    </section>

    <section class="meta-grid">
      <article v-for="item in sourceSummary" :key="item.label" class="meta-card">
        <span class="meta-label">{{ item.label }}</span>
        <strong class="meta-value">{{ item.value }}</strong>
      </article>
    </section>

    <section class="section-stack">
      <article v-for="section in metricSections" :key="section.key" class="section-panel">
        <div class="section-heading">
          <h2>{{ section.title }}</h2>
        </div>

        <div class="sensor-grid">
          <article v-for="card in section.metrics" :key="card.key" class="sensor-card">
            <span class="card-label">{{ card.label }}</span>
            <div class="sensor-value">
              <strong>{{ card.value }}</strong>
              <span>{{ card.unit }}</span>
            </div>
            <p class="card-time">Data time: {{ card.time || '--' }}</p>
          </article>
        </div>
      </article>
    </section>

    <section class="payload-panel">
      <div class="payload-header">
        <h2>Raw Payload</h2>
        <p>Data returned from the backend telemetry service</p>
      </div>
      <pre>{{ rawPayloadText || 'No payload received yet.' }}</pre>
    </section>
  </main>
</template>
