export const mqttConfig = {
  brokerUrl: '',
  topic: '',
  productKey: '',
  deviceName: '',
  password: '',
  reconnectPeriod: 3_000,
  connectTimeout: 10_000,
  protocolVersion: 4
}

export function getMqttConnectionOptions() {
  return {
    clientId: '',
    username: '',
    password: '',
    clean: true,
    reconnectPeriod: mqttConfig.reconnectPeriod,
    connectTimeout: mqttConfig.connectTimeout,
    protocolVersion: mqttConfig.protocolVersion
  }
}
