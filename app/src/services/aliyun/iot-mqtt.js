import mqtt from 'mqtt'
import { Capacitor } from '@capacitor/core'
import {
  aliyunIotConfig,
  getAliyunMqttMissingFields,
  isAliyunMqttConfigured
} from '../../config/aliyun-iot'
import { flattenTelemetryPayload } from '../pet/metric-definitions'
import { petLocalStore } from '../pet/local-store'

const mqttState = {
  started: false,
  connected: false,
  subscribed: false,
  lastMessageAt: 0,
  lastError: '',
  skippedReason: ''
}

let mqttClient = null
let startPromise = null

export async function ensureAliyunMqttStarted() {
  if (!aliyunIotConfig.mqtt.enabled) {
    return getAliyunMqttState()
  }

  const skippedReason = getMqttRuntimeSkipReason()
  if (skippedReason) {
    markMqttSkipped(skippedReason)
    return getAliyunMqttState()
  }

  if (!isAliyunMqttConfigured()) {
    const missingFields = getAliyunMqttMissingFields().join(', ')
    throw new Error(`阿里云 MQTT 配置不完整，请检查：${missingFields}`)
  }

  if (mqttClient || startPromise) {
    return startPromise || getAliyunMqttState()
  }

  startPromise = startAliyunMqtt()
    .finally(() => {
      startPromise = null
    })

  return startPromise
}

export function getAliyunMqttState() {
  return { ...mqttState }
}

function startAliyunMqtt() {
  mqttState.started = true
  mqttState.lastError = ''
  mqttState.skippedReason = ''

  mqttClient = mqtt.connect(aliyunIotConfig.mqtt.brokerUrl, {
    clientId: aliyunIotConfig.mqtt.clientId,
    username: aliyunIotConfig.mqtt.username,
    password: aliyunIotConfig.mqtt.password,
    protocolVersion: aliyunIotConfig.mqtt.protocolVersion,
    reconnectPeriod: aliyunIotConfig.mqtt.reconnectPeriod,
    connectTimeout: aliyunIotConfig.mqtt.connectTimeout,
    clean: true,
    resubscribe: true
  })

  mqttClient.on('connect', () => {
    mqttState.connected = true
    mqttState.lastError = ''
    subscribeTopics()
  })

  mqttClient.on('reconnect', () => {
    mqttState.connected = false
    mqttState.subscribed = false
  })

  mqttClient.on('close', () => {
    mqttState.connected = false
    mqttState.subscribed = false
  })

  mqttClient.on('error', (error) => {
    mqttState.lastError = error instanceof Error ? error.message : String(error || 'MQTT 连接失败')
  })

  mqttClient.on('message', (topic, payload) => {
    handleMqttMessage(topic, payload).catch((error) => {
      mqttState.lastError = error instanceof Error ? error.message : 'MQTT 消息处理失败'
    })
  })

  return Promise.resolve(getAliyunMqttState())
}

function subscribeTopics() {
  if (!mqttClient) {
    return
  }

  mqttClient.subscribe(aliyunIotConfig.mqtt.topics, { qos: 0 }, (error) => {
    if (error) {
      mqttState.subscribed = false
      mqttState.lastError = error.message || 'MQTT 订阅失败'
      return
    }

    mqttState.subscribed = true
    mqttState.lastError = ''
  })
}

function getMqttRuntimeSkipReason() {
  const runtime = aliyunIotConfig.mqtt.runtime
  const isNative = Capacitor.isNativePlatform()

  if (runtime === 'always') {
    return ''
  }

  if (runtime === 'web') {
    return isNative ? '当前 MQTT 配置仅允许 Web 调试环境启动' : ''
  }

  return isNative ? '' : 'Web 调试环境已跳过 MQTT 直连，使用 OpenAPI 与本地缓存刷新数据'
}

function markMqttSkipped(reason) {
  if (mqttClient) {
    mqttClient.end(true)
    mqttClient = null
  }

  mqttState.started = false
  mqttState.connected = false
  mqttState.subscribed = false
  mqttState.lastError = ''
  mqttState.skippedReason = reason
}

async function handleMqttMessage(topic, payloadBuffer) {
  const payloadText = payloadBuffer?.toString?.('utf8') || String(payloadBuffer || '')
  if (!payloadText) {
    return
  }

  const payload = JSON.parse(payloadText)
  const points = flattenTelemetryPayload(payload, {
    productKey: aliyunIotConfig.productKey,
    topic
  })

  if (!points.length) {
    return
  }

  await petLocalStore.upsertMetricPoints(points)
  mqttState.lastMessageAt = Date.now()
  mqttState.lastError = ''
  await petLocalStore.setMeta('mqtt:lastMessageAt', mqttState.lastMessageAt)
}
