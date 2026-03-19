import crypto from 'node:crypto'
import mqtt from 'mqtt'

const mode = process.argv[2] || 'device-tcp'

const host = 'iot-06z00b1eo2alugk.mqtt.iothub.aliyuncs.com'
const productKey = 'k1wxakcs6OI'
const propertyPostTopic = `/sys/${productKey}/DHT11/thing/event/property/post`
const webForwardTopic = `/${productKey}/webapp/user/get`
const timeoutMs = 60_000

const presets = {
  'device-tcp': {
    url: `mqtt://${host}:1883`,
    clientId:
      'k1wxakcs6OI.DHT11|securemode=2,signmethod=hmacsha256,timestamp=1773712773834|',
    username: 'DHT11&k1wxakcs6OI',
    password:
      'f2c31edbf1045e2cf0f49e67765840a2e90fd6e63ed7608056aba6933178be92',
    topic: propertyPostTopic,
    description: 'Use the existing DHT11 device credential over raw MQTT/TCP.'
  },
  'web-wss': createWebWssPreset()
}

if (!presets[mode]) {
  console.error(`Unknown mode: ${mode}`)
  console.error('Supported modes: device-tcp, web-wss')
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
  console.log(`Received at: ${new Date().toISOString()}`)
  console.log(`Message received on ${topic}:`)
  console.log(payload.toString())
  shutdown(0)
})

client.on('error', (error) => {
  clearTimeout(timeout)
  console.error('MQTT error:', error.message)
  shutdown(1)
})

function createWebWssPreset() {
  const deviceName = 'webapp'
  const deviceSecret = '03a0edc6d46dd71a4eecd81ec95f5bd0'
  const rawClientId = `${productKey}.${deviceName}`
  const signContent = `clientId${rawClientId}deviceName${deviceName}productKey${productKey}`
  const password = crypto
    .createHmac('sha256', deviceSecret)
    .update(signContent)
    .digest('hex')

  return {
    url: `wss://${host}:443/mqtt`,
    clientId: `${rawClientId}|securemode=2,signmethod=hmacsha256|`,
    username: `${deviceName}&${productKey}`,
    password,
    topic: webForwardTopic,
    description:
      'Use the documented webapp credential over MQTT/WebSocket Secure and subscribe to the forwarded custom topic.'
  }
}



