<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import mqtt from 'mqtt'

const brokerUrl = 'wss://iot-06z00b1eo2alugk.mqtt.iothub.aliyuncs.com:443/mqtt'
const topic = '/k1wxaEnEO8L/petInfo/user/get'
const productKey = 'k1wxaEnEO8L'
const deviceName = 'petInfo'
const username = `${deviceName}&${productKey}`
const clientId = `${productKey}.${deviceName}|securemode=2,signmethod=hmacsha256|`
const password = '4f106f7ea256495207f2235389a9e792744eab503918fcf632e633a72ac6bed7'

const client = ref(null)
const status = ref('idle')
const errorMessage = ref('')
const latestTopic = ref('')
const latestPayloadText = ref('')
const latestPayload = ref(null)

const metricDefinitions = [
  { key: 'PetHouse:Temp', label: 'Temperature', unit: 'C' },
  { key: 'PetHouse:Humi', label: 'Humidity', unit: '%' },
  { key: 'PetHouse:CO2', label: 'CO2', unit: 'ppm' },
  { key: 'PetHouse:CH2O', label: 'CH2O', unit: 'ppb' },
  { key: 'PetHouse:VOC', label: 'VOC', unit: 'lvl' },
  { key: 'PetHouse:MQ135', label: 'MQ135', unit: 'lvl' },
  { key: 'PetHouse:Weight', label: 'Weight', unit: 'kg' }
]

const statusText = computed(() => {
  if (status.value === 'subscribed') return 'Connected and subscribed'
  if (status.value === 'connected') return 'Connected'
  if (status.value === 'connecting') return 'Connecting'
  if (status.value === 'error') return 'Error'
  return 'Idle'
})

const sourceSummary = computed(() => {
  if (!latestPayload.value) {
    return [
      { label: 'Topic', value: topic },
      { label: 'Source Device', value: '--' },
      { label: 'Request ID', value: '--' },
      { label: 'Created At', value: '--' }
    ]
  }

  return [
    { label: 'Topic', value: latestTopic.value || topic },
    { label: 'Source Device', value: latestPayload.value.deviceName || '--' },
    { label: 'Request ID', value: latestPayload.value.requestId || '--' },
    { label: 'Created At', value: formatTime(latestPayload.value.gmtCreate) }
  ]
})

const sensorCards = computed(() => {
  const items = latestPayload.value?.items ?? {}

  return metricDefinitions.map((metric) => ({
    key: metric.key,
    label: metric.label,
    unit: metric.unit,
    value: items[metric.key]?.value ?? '--',
    time: formatTime(items[metric.key]?.time)
  }))
})

function connectMqtt() {
  disconnect()
  status.value = 'connecting'
  errorMessage.value = ''

  const nextClient = mqtt.connect(brokerUrl, {
    clientId,
    username,
    password,
    clean: true,
    connectTimeout: 10_000,
    reconnectPeriod: 3_000,
    protocolVersion: 4
  })

  nextClient.on('connect', () => {
    status.value = 'connected'

    nextClient.subscribe(topic, { qos: 0 }, (error) => {
      if (error) {
        status.value = 'error'
        errorMessage.value = `Subscribe failed: ${error.message}`
        return
      }

      status.value = 'subscribed'
    })
  })

  nextClient.on('message', (messageTopic, payload) => {
    latestTopic.value = messageTopic
    latestPayloadText.value = payload.toString()

    try {
      latestPayload.value = JSON.parse(latestPayloadText.value)
      errorMessage.value = ''
    } catch (error) {
      latestPayload.value = null
      errorMessage.value = `Payload parse failed: ${error.message}`
    }
  })

  nextClient.on('reconnect', () => {
    status.value = 'connecting'
  })

  nextClient.on('close', () => {
    if (status.value !== 'idle') {
      status.value = 'connecting'
    }
  })

  nextClient.on('error', (error) => {
    status.value = 'error'
    errorMessage.value = error.message
  })

  client.value = nextClient
}

function disconnect() {
  if (client.value) {
    client.value.end(true)
    client.value = null
  }

  status.value = 'idle'
}

function clearPayload() {
  latestTopic.value = ''
  latestPayloadText.value = ''
  latestPayload.value = null
  errorMessage.value = ''
}

function formatTime(value) {
  if (!value) return '--'

  const asNumber = Number(value)
  if (!Number.isFinite(asNumber)) return '--'

  return new Date(asNumber).toLocaleString('zh-CN', {
    hour12: false
  })
}

onBeforeUnmount(() => {
  disconnect()
})
</script>

<template>
  <main class="dashboard-shell">
    <section class="hero-panel">
      <p class="eyebrow">MoodPaws MQTT Test</p>
      <h1>petInfo Test Console</h1>
      <p class="lead">
        Connect with the <code>petInfo</code> web device and listen on
        <code>{{ topic }}</code>
      </p>

      <div class="status-row">
        <span class="status-pill" :data-state="status">{{ statusText }}</span>
        <span class="status-hint">Broker: {{ brokerUrl }}</span>
      </div>

      <div class="action-row">
        <button class="primary-button" type="button" @click="connectMqtt">
          Connect
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

    <section class="sensor-grid">
      <article v-for="card in sensorCards" :key="card.key" class="sensor-card">
        <span class="card-label">{{ card.label }}</span>
        <div class="sensor-value">
          <strong>{{ card.value }}</strong>
          <span>{{ card.unit }}</span>
        </div>
        <p class="card-time">Data time: {{ card.time }}</p>
      </article>
    </section>

    <section class="payload-panel">
      <div class="payload-header">
        <h2>Raw Payload</h2>
        <p>Expected source device: <code>Collar</code></p>
      </div>
      <pre>{{ latestPayloadText || 'No payload received yet.' }}</pre>
    </section>
  </main>
</template>
