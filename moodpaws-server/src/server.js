import { createApp } from './app.js'
import { env } from './config/env.js'
import { initSchema } from './db/schema.js'
import { seedDefaultEmotionSnapshot } from './db/repositories/emotion-repo.js'
import { createMqttSubscriber } from './mqtt/client.js'
import { consumeMessage } from './mqtt/consumer.js'

const mqttState = {
  enabled: false,
  connected: false,
  subscribed: false,
  topics: env.mqtt.topics,
  lastMessageAt: null,
  lastError: '',
  lastEvent: 'idle',
  lastConnackCode: null,
  lastDisconnectPacket: null,
  lastSubscribeGranted: []
}

function maskSecret(secret) {
  if (!secret) return ''
  if (secret.length <= 8) return '*'.repeat(secret.length)
  return `${secret.slice(0, 4)}***${secret.slice(-4)}`
}

function setMqttEvent(event) {
  mqttState.lastEvent = event
}

function logMqtt(message, extra) {
  if (extra === undefined) {
    console.log(`[mqtt] ${message}`)
    return
  }
  console.log(`[mqtt] ${message}`, extra)
}

async function bootstrap() {
  await initSchema()
  await seedDefaultEmotionSnapshot()

  const app = createApp({ mqttState })

  logMqtt('starting subscriber', {
    brokerUrl: env.mqtt.brokerUrl,
    topics: env.mqtt.topics,
    clientId: env.mqtt.clientId,
    username: env.mqtt.username,
    passwordMasked: maskSecret(env.mqtt.password),
    reconnectPeriod: env.mqtt.reconnectPeriod,
    connectTimeout: env.mqtt.connectTimeout,
    protocolVersion: env.mqtt.protocolVersion,
    clean: true
  })

  const subscriber = createMqttSubscriber({
    onConnect(_client, connack) {
      mqttState.enabled = true
      mqttState.connected = true
      mqttState.subscribed = false
      mqttState.lastError = ''
      mqttState.lastConnackCode = connack?.returnCode ?? connack?.reasonCode ?? 0
      mqttState.lastDisconnectPacket = null
      setMqttEvent('connect')
      logMqtt('connected', {
        sessionPresent: connack?.sessionPresent ?? false,
        returnCode: mqttState.lastConnackCode
      })
    },
    onSubscribe(granted) {
      mqttState.subscribed = true
      mqttState.lastSubscribeGranted = granted ?? []
      setMqttEvent('subscribed')
      logMqtt('subscribed', granted ?? [])
    },
    onSubscribeError(error) {
      mqttState.subscribed = false
      mqttState.lastError = error.message
      setMqttEvent('subscribe_error')
      logMqtt('subscribe failed', { message: error.message })
    },
    async onMessage(topic, payload) {
      try {
        await consumeMessage(topic, payload)
        mqttState.lastMessageAt = Date.now()
        setMqttEvent('message')
      } catch (error) {
        mqttState.lastError = error.message
        setMqttEvent('message_error')
        logMqtt('message handling failed', { message: error.message })
      }
    },
    onReconnect() {
      mqttState.connected = false
      mqttState.subscribed = false
      setMqttEvent('reconnect')
      logMqtt('reconnecting')
    },
    onClose() {
      mqttState.connected = false
      mqttState.subscribed = false
      setMqttEvent('close')
      logMqtt('connection closed')
    },
    onOffline() {
      mqttState.connected = false
      mqttState.subscribed = false
      setMqttEvent('offline')
      logMqtt('client offline')
    },
    onEnd() {
      mqttState.connected = false
      mqttState.subscribed = false
      setMqttEvent('end')
      logMqtt('client ended')
    },
    onError(error) {
      mqttState.lastError = error.message
      setMqttEvent('error')
      logMqtt('client error', {
        name: error.name,
        code: error.code,
        message: error.message
      })
    },
    onPacketReceive(packet) {
      if (packet?.cmd === 'connack') {
        mqttState.lastConnackCode = packet.returnCode ?? packet.reasonCode ?? null
        setMqttEvent('connack')
        logMqtt('received connack', {
          returnCode: mqttState.lastConnackCode,
          sessionPresent: packet.sessionPresent ?? false
        })
      }

      if (packet?.cmd === 'suback') {
        mqttState.lastSubscribeGranted = packet.granted ?? []
        setMqttEvent('suback')
        logMqtt('received suback', {
          messageId: packet.messageId,
          granted: packet.granted
        })
      }
    },
    onPacketSend(packet) {
      if (packet?.cmd === 'connect') {
        setMqttEvent('connect_sent')
        logMqtt('sent connect packet')
      }

      if (packet?.cmd === 'subscribe') {
        setMqttEvent('subscribe_sent')
        logMqtt('sent subscribe packet', {
          messageId: packet.messageId,
          subscriptions: packet.subscriptions
        })
      }

      if (packet?.cmd === 'disconnect') {
        mqttState.lastDisconnectPacket = {
          cmd: packet.cmd,
          reasonCode: packet.reasonCode ?? null
        }
        setMqttEvent('disconnect_sent')
        logMqtt('sent disconnect packet', mqttState.lastDisconnectPacket)
      }
    }
  })

  mqttState.enabled = subscriber.enabled

  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`moodpaws-server listening on http://0.0.0.0:${env.port}`)
  })

  const shutdown = () => {
    subscriber.client?.end(true)
    server.close(() => process.exit(0))
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

bootstrap().catch((error) => {
  console.error('Failed to start moodpaws-server:', error)
  process.exit(1)
})
