import mqtt from 'mqtt'
import { getMqttConnectionOptions, mqttConfig } from './config'

export function createMqttClient(handlers = {}) {
  const client = mqtt.connect(mqttConfig.brokerUrl, getMqttConnectionOptions())

  client.on('connect', () => {
    handlers.onConnect?.(client)
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

  client.on('error', (error) => {
    handlers.onError?.(error)
  })

  return client
}
