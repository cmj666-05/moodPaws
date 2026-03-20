export const mqttConfig = {
  brokerUrl: 'wss://iot-06z00b1eo2alugk.mqtt.iothub.aliyuncs.com:443/mqtt',
  topic: '/k1wxaEnEO8L/petInfo/user/get',
  productKey: 'k1wxaEnEO8L',
  deviceName: 'petInfo',
  password: '4f106f7ea256495207f2235389a9e792744eab503918fcf632e633a72ac6bed7',
  reconnectPeriod: 3_000,
  connectTimeout: 10_000,
  protocolVersion: 4
}

export function getMqttConnectionOptions() {
  const { productKey, deviceName, password, reconnectPeriod, connectTimeout, protocolVersion } =
    mqttConfig

  return {
    clientId: `${productKey}.${deviceName}|securemode=2,signmethod=hmacsha256|`,
    username: `${deviceName}&${productKey}`,
    password,
    clean: true,
    reconnectPeriod,
    connectTimeout,
    protocolVersion
  }
}
