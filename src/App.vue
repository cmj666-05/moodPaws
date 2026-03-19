<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import mqtt from 'mqtt'

const brokerUrl = 'wss://iot-06z00b1eo2alugk.mqtt.iothub.aliyuncs.com:443/mqtt'
const topic = '/k1wxakcs6OI/webapp/user/get'
const productKey = 'k1wxakcs6OI'
const deviceName = 'webapp'
const password = '8a917c9883d711dfaed7bdc3ee8224be25f4ac9abeb7a39a4b0eb49bfd0d14fc'
const clientId = `${productKey}.${deviceName}|securemode=2,signmethod=hmacsha256|`
const username = `${deviceName}&${productKey}`

const client = ref(null)
const status = ref('idle')
const errorMessage = ref('')
const latestPayload = ref(null)

const sensorCards = computed(() => {
  const items = latestPayload.value?.items ?? {}

  return [
    { key: 'Temp1', label: 'Temp 1', unit: '°C', value: items.Temp1?.value ?? '--' },
    { key: 'Temp2', label: 'Temp 2', unit: '°C', value: items.Temp2?.value ?? '--' },
    { key: 'Humi1', label: 'Humi 1', unit: '%', value: items.Humi1?.value ?? '--' },
    { key: 'Humi2', label: 'Humi 2', unit: '%', value: items.Humi2?.value ?? '--' }
  ]
})

function disconnect() {
  if (client.value) {
    client.value.end(true)
    client.value = null
  }

  status.value = 'idle'
}

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
        errorMessage.value = `订阅失败: ${error.message}`
        return
      }

      status.value = 'subscribed'
    })
  })

  nextClient.on('message', (messageTopic, payload) => {
    const text = payload.toString()

    try {
      latestPayload.value = JSON.parse(text)
      errorMessage.value = ''
    } catch (error) {
      latestPayload.value = null
      errorMessage.value = `消息解析失败: ${error.message}`
    }

    if (messageTopic !== topic) {
      errorMessage.value = `收到非预期 Topic: ${messageTopic}`
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

onBeforeUnmount(() => {
  disconnect()
})
</script>

<template>
  <main class="dashboard-shell">
    <header class="app-header">
      <p class="eyebrow">MoodPaws</p>
      <h1>实时环境数据</h1>
      <p class="connection-text">
        {{ status === 'subscribed' ? '已连接到设备数据' : '点击开始连接获取最新数据' }}
      </p>
    </header>

    <section class="action-row">
      <button class="primary-button" type="button" @click="connectMqtt">开始连接</button>
      <button class="ghost-button" type="button" @click="disconnect">断开连接</button>
    </section>

    <section class="sensor-grid">
      <article v-for="card in sensorCards" :key="card.key" class="sensor-card">
        <span class="card-label">{{ card.label }}</span>
        <div class="sensor-value">
          <strong>{{ card.value }}</strong>
          <span>{{ card.unit }}</span>
        </div>
      </article>
    </section>

    <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
  </main>
</template>
