import { env } from './env.js'

export function getMqttConfig() {
  return {
    brokerUrl: env.mqtt.brokerUrl,
    topics: env.mqtt.topics,
    options: {
      clientId: env.mqtt.clientId,
      username: env.mqtt.username,
      password: env.mqtt.password,
      clean: true,
      reconnectPeriod: env.mqtt.reconnectPeriod,
      connectTimeout: env.mqtt.connectTimeout,
      protocolVersion: env.mqtt.protocolVersion
    }
  }
}
