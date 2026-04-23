import mqtt from 'mqtt'
import dotenv from 'dotenv'

dotenv.config()

const mode = process.argv[2] || 'env'
const timeoutMs = 60_000

const presets = {
  env: createEnvPreset()
}

if (!presets[mode]) {
  console.error(`Unknown mode: ${mode}`)
  console.error('Supported modes: env')
  process.exit(1)
}

const config = presets[mode]

console.log(`Mode: ${mode}`)
console.log(config.description)
console.log(`Broker: ${config.url}`)
console.log(`Topic: ${config.topic}`)
console.log(`Client ID: ${config.clientId}`)
console.log(`Username: ${config.username}`)
console.log(`Password: ${maskSecret(config.password)}`)

const client = mqtt.connect(config.url, {
  clientId: config.clientId,
  username: config.username,
  password: config.password,
  connectTimeout: 10_000,
  reconnectPeriod: 0,
  clean: true,
  protocolVersion: 4
})

const shutdown = (code = 0) => {
  client.end(true, () => process.exit(code))
  setTimeout(() => process.exit(code), 300)
}

const timeout = setTimeout(() => {
  console.error(`No message received before timeout (${timeoutMs}ms).`)
  shutdown(2)
}, timeoutMs)

client.on('connect', () => {
  console.log('MQTT connected.')
  client.subscribe(config.topic, { qos: 0 }, (error) => {
    if (error) {
      clearTimeout(timeout)
      console.error('Subscribe failed:', error.message)
      shutdown(1)
      return
    }

    console.log('Subscribed. Waiting for a message...')
  })
})

client.on('message', (topic, payload) => {
  clearTimeout(timeout)
  const text = payload.toString()

  console.log(`Received at: ${new Date().toISOString()}`)
  console.log(`Message received on ${topic}:`)
  console.log(text)

  try {
    const parsed = JSON.parse(text)
    const items = parsed.items ?? {}
    const summary = {
      sourceDeviceName: parsed.deviceName ?? null,
      requestId: parsed.requestId ?? null,
      emotionState: items.EmotionState?.value ?? null,
      collarTemp: items['Collar:temp']?.value ?? null,
      x: items['Collar:BNO085']?.value?.X ?? null,
      y: items['Collar:BNO085']?.value?.Y ?? null,
      z: items['Collar:BNO085']?.value?.Z ?? null,
      heartRate: items['Collar:MAX30102']?.value?.HeartRate ?? null,
      spo2: items['Collar:MAX30102']?.value?.SPO2 ?? null,
      longitude: items['Collar:GPS']?.value?.Longitude ?? null,
      latitude: items['Collar:GPS']?.value?.Latitude ?? null
    }

    console.log('Parsed summary:')
    console.log(JSON.stringify(summary, null, 2))
  } catch (error) {
    console.error(`Payload parse failed: ${error.message}`)
  }

  shutdown(0)
})

client.on('packetreceive', (packet) => {
  if (packet?.cmd === 'connack') {
    console.log('CONNACK:', JSON.stringify({
      returnCode: packet.returnCode,
      reasonCode: packet.reasonCode,
      sessionPresent: packet.sessionPresent
    }))
  }

  if (packet?.cmd === 'suback') {
    console.log('SUBACK:', JSON.stringify({
      messageId: packet.messageId,
      granted: packet.granted,
      reasonCodes: packet.reasonCodes
    }))
  }
})

client.on('error', (error) => {
  clearTimeout(timeout)
  console.error('MQTT error:', error.message)
  shutdown(1)
})

function createEnvPreset() {
  const topic = (process.env.MQTT_TOPICS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)[0]

  return {
    url: process.env.MQTT_BROKER_URL || '',
    clientId: process.env.MQTT_CLIENT_ID || '',
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    topic,
    description: 'Use the MQTT connection settings from .env.'
  }
}

function maskSecret(secret) {
  if (!secret) return ''
  if (secret.length <= 8) return '*'.repeat(secret.length)
  return `${secret.slice(0, 4)}***${secret.slice(-4)}`
}
