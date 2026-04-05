import mqtt from 'mqtt'
import { getMqttConfig } from '../config/mqtt.js'

export function createMqttSubscriber(handlers = {}) {
  const config = getMqttConfig()

  if (!config.brokerUrl || !config.topics.length) {
    return { client: null, enabled: false, topics: config.topics }
  }

  const client = mqtt.connect(config.brokerUrl, config.options)

  client.on('connect', (connack) => {
    handlers.onConnect?.(client, connack)
    client.subscribe(config.topics, { qos: 0 }, (error, granted) => {
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

  client.on('reconnect', () => {
    handlers.onReconnect?.()
  })

  client.on('close', () => {
    handlers.onClose?.()
  })

  client.on('offline', () => {
    handlers.onOffline?.()
  })

  client.on('end', () => {
    handlers.onEnd?.()
  })

  client.on('error', (error) => {
    handlers.onError?.(error)
  })

  client.on('packetreceive', (packet) => {
    handlers.onPacketReceive?.(packet)
  })

  client.on('packetsend', (packet) => {
    handlers.onPacketSend?.(packet)
  })

  return { client, enabled: true, topics: config.topics }
}
