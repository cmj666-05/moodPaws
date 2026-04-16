import crypto from 'node:crypto'
import mqtt from 'mqtt'

const mode = process.argv[2] || 'web-wss'
const host = 'iot-06z00b1eo2alugk.mqtt.iothub.aliyuncs.com'
const timeoutMs = 60_000

const testWebDevice = {
  productKey: 'k1wxaEnEO8L',
  deviceName: 'petInfo',
  deviceSecret: '53e62471edfbf70c7b225dd260ca7d4e'
}

const legacyDevice = {
  productKey: 'k1wxakcs6OI',
  deviceName: 'DHT11',
  clientId:
    'k1wxakcs6OI.DHT11|securemode=2,signmethod=hmacsha256,timestamp=1773712773834|',
  username: 'DHT11&k1wxakcs6OI',
  password:
    'f2c31edbf1045e2cf0f49e67765840a2e90fd6e63ed7608056aba6933178be92'
}

const presets = {
  'web-wss': createWebPreset(),
  'legacy-device-tcp': {
    url: `mqtt://${host}:1883`,
    clientId: legacyDevice.clientId,
    username: legacyDevice.username,
    password: legacyDevice.password,
    topic: `/sys/${legacyDevice.productKey}/${legacyDevice.deviceName}/thing/event/property/post`,
    description:
      'Use the legacy DHT11 device credential over raw MQTT/TCP for comparison.'
  }
}

if (!presets[mode]) {
  console.error(`Unknown mode: ${mode}`)
  console.error('Supported modes: web-wss, legacy-device-tcp')
  process.exit(1)
}

const config = presets[mode]

console.log(`Mode: ${mode}`)
console.log(config.description)
console.log(`Broker: ${config.url}`)
console.log(`Topic: ${config.topic}`)

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
      temp: items['PetHouse:Temp']?.value ?? null,
      humi: items['PetHouse:Humi']?.value ?? null,
      co2: items['PetHouse:CO2']?.value ?? null,
      ch2o: items['PetHouse:CH2O']?.value ?? null,
      voc: items['PetHouse:VOC']?.value ?? null,
      mq135: items['PetHouse:MQ135']?.value ?? null,
      weight: items['PetHouse:Weight']?.value ?? null,
      x: items['Collar:XYZ']?.value?.X ?? null,
      y: items['Collar:XYZ']?.value?.Y ?? null,
      z: items['Collar:XYZ']?.value?.Z ?? null,
      heartRate: items['Collar:XKXY']?.value?.HeartRate ?? null,
      spo2: items['Collar:XKXY']?.value?.SPO2 ?? null,
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

client.on('error', (error) => {
  clearTimeout(timeout)
  console.error('MQTT error:', error.message)
  shutdown(1)
})

function createWebPreset() {
  const rawClientId = `${testWebDevice.productKey}.${testWebDevice.deviceName}`
  const signContent =
    `clientId${rawClientId}` +
    `deviceName${testWebDevice.deviceName}` +
    `productKey${testWebDevice.productKey}`
  const password = crypto
    .createHmac('sha256', testWebDevice.deviceSecret)
    .update(signContent)
    .digest('hex')

  return {
    url: `wss://${host}:443/mqtt`,
    clientId: `${rawClientId}|securemode=2,signmethod=hmacsha256|`,
    username: `${testWebDevice.deviceName}&${testWebDevice.productKey}`,
    password,
    topic: `/${testWebDevice.productKey}/${testWebDevice.deviceName}/user/get`,
    description:
      'Use the petInfo test web device over MQTT/WebSocket Secure and subscribe to the forwarded custom topic.'
  }
}
