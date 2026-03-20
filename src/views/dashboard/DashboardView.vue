<script setup>
import { useMqtt } from '../../composables/useMqtt'

const {
  brokerUrl,
  topic,
  status,
  statusText,
  errorMessage,
  latestPayloadText,
  sourceSummary,
  metricSections,
  connect,
  disconnect,
  clearPayload
} = useMqtt()
</script>

<template>
  <main class="dashboard-shell">
    <section class="hero-panel">
      <p class="eyebrow">MoodPaws Android</p>
      <h1>PetHouse + Collar</h1>
      <p class="lead">
        Android app overview for the two source devices forwarded to
        <code>petInfo</code>. Current topic:
        <code>{{ topic }}</code>
      </p>

      <div class="status-row">
        <span class="status-pill" :data-state="status">{{ statusText }}</span>
        <span class="status-hint">Broker: {{ brokerUrl }}</span>
      </div>

      <div class="action-row">
        <button class="primary-button" type="button" @click="connect">
          Start Sync
        </button>
        <button class="ghost-button" type="button" @click="disconnect">
          Disconnect
        </button>
        <button class="ghost-button" type="button" @click="clearPayload">
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
            <p class="card-time">Data time: {{ card.time }}</p>
          </article>
        </div>
      </article>
    </section>

    <section class="payload-panel">
      <div class="payload-header">
        <h2>Raw Payload</h2>
        <p>petInfo receives forwarded messages from multiple devices</p>
      </div>
      <pre>{{ latestPayloadText || 'No payload received yet.' }}</pre>
    </section>
  </main>
</template>
