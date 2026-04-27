import mqtt from 'mqtt'
import { env } from '../config/env.js'

export function createMqttSubscriber(handlers = {}) {
  if (!env.mqtt.enabled || !env.mqtt.brokerUrl) {
    return {
      enabled: false,
      client: null
    }
  }

  const client = mqtt.connect(env.mqtt.brokerUrl, {
    clientId: env.mqtt.clientId,
    username: env.mqtt.username,
    password: env.mqtt.password,
    rejectUnauthorized: env.mqtt.rejectUnauthorized,
    reconnectPeriod: env.mqtt.reconnectPeriod,
    connectTimeout: env.mqtt.connectTimeout,
    protocolVersion: env.mqtt.protocolVersion,
    clean: true
  })

  client.on('connect', (connack) => {
    handlers.onConnect?.(client, connack)
    if (env.mqtt.topics.length === 0) {
      return
    }

    client.subscribe(env.mqtt.topics, (error, granted) => {
      if (error) {
        handlers.onSubscribeError?.(error)
        return
      }

      handlers.onSubscribe?.(granted)
    })
  })

  client.on('message', (topic, payload) => {
    handlers.onMessage?.(topic, payload)
  })
  client.on('reconnect', () => handlers.onReconnect?.())
  client.on('close', () => handlers.onClose?.())
  client.on('offline', () => handlers.onOffline?.())
  client.on('end', () => handlers.onEnd?.())
  client.on('error', (error) => handlers.onError?.(error))
  client.on('packetreceive', (packet) => handlers.onPacketReceive?.(packet))
  client.on('packetsend', (packet) => handlers.onPacketSend?.(packet))

  return {
    enabled: true,
    client
  }
}
