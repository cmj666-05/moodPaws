import { createApp } from './app.js'
import { env } from './config/env.js'
import { initSchema } from './db/schema.js'
import { seedDefaultEmotionSnapshot } from './db/repositories/emotion-repo.js'
import { createMqttSubscriber } from './mqtt/client.js'
import { consumeMessage } from './mqtt/consumer.js'
import { createServiceDiscovery } from './discovery/service-discovery.js'
import { getAccessibleAddresses } from './utils/network.js'
import { createServiceId } from './utils/service-id.js'

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

const serviceState = {
  serviceId: createServiceId({
    configuredId: env.service.id,
    port: env.port,
    dataMode: env.dataMode
  }),
  discovery: {
    enabled: env.service.mdnsEnabled,
    published: false,
    serviceName: env.service.name,
    serviceType: 'http',
    healthPath: env.service.healthPath,
    publishedAt: null,
    stoppedAt: null,
    lastError: '',
    lastEvent: 'idle'
  }
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

function logDiscovery(message, extra) {
  if (extra === undefined) {
    console.log(`[discovery] ${message}`)
    return
  }
  console.log(`[discovery] ${message}`, extra)
}

function logAccessibleAddresses(addresses) {
  console.log('[server] accessible addresses')
  for (const item of addresses) {
    console.log(`- ${item.url}`)
  }
  console.log(`[server] health check path: ${env.service.healthPath}`)
  console.log(`[server] service id: ${serviceState.serviceId}`)
  if (env.service.mdnsEnabled) {
    console.log(`[server] mDNS service: ${serviceState.discovery.serviceName}._http._tcp.local`)
  }
}

async function bootstrap() {
  await initSchema()
  await seedDefaultEmotionSnapshot()

  const app = createApp({ mqttState, serviceState })
  const discovery = createServiceDiscovery({
    env,
    port: env.port,
    serviceId: serviceState.serviceId,
    discoveryState: serviceState.discovery
  })

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

  const server = app.listen(env.port, '0.0.0.0', async () => {
    console.log(`moodpaws-server listening on http://0.0.0.0:${env.port}`)

    const published = await discovery.start()
    if (published) {
      logDiscovery('published mDNS service', discovery.getState())
    } else if (serviceState.discovery.enabled) {
      logDiscovery('failed to publish mDNS service', {
        lastError: serviceState.discovery.lastError
      })
    } else {
      logDiscovery('mDNS disabled')
    }

    logAccessibleAddresses(getAccessibleAddresses(env.port))
  })

  let shuttingDown = false

  const shutdown = async () => {
    if (shuttingDown) {
      return
    }

    shuttingDown = true
    await discovery.stop()
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
