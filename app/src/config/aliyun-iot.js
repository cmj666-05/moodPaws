const DEFAULT_PRODUCT_KEY = 'k1wxaEnEO8L'
const DEFAULT_DEVICES = ['Collar', 'DogHouse']

const env = import.meta.env

export const aliyunIotConfig = Object.freeze({
  regionId: safeTrim(env.VITE_ALIYUN_REGION_ID || 'cn-shanghai'),
  endpoint: normalizeEndpoint(env.VITE_ALIYUN_IOT_ENDPOINT || ''),
  accessKeyId: safeTrim(env.VITE_ALIYUN_ACCESS_KEY_ID || ''),
  accessKeySecret: safeTrim(env.VITE_ALIYUN_ACCESS_KEY_SECRET || ''),
  iotInstanceId: safeTrim(env.VITE_ALIYUN_IOT_INSTANCE_ID || ''),
  productKey: safeTrim(env.VITE_ALIYUN_PRODUCT_KEY || DEFAULT_PRODUCT_KEY),
  devices: parseDeviceList(env.VITE_ALIYUN_DEVICES || DEFAULT_DEVICES.join(',')),
  queryMode: normalizeQueryMode(env.VITE_ALIYUN_PROPERTY_QUERY_MODE || 'standard'),
  historyLookbackMinutes: parsePositiveInt(env.VITE_ALIYUN_HISTORY_LOOKBACK_MINUTES, 24 * 60),
  historyMaxPagesPerProperty: parsePositiveInt(env.VITE_ALIYUN_HISTORY_MAX_PAGES, 3),
  historyPageSize: parsePositiveInt(env.VITE_ALIYUN_HISTORY_PAGE_SIZE, 50),
  onlineWindowMinutes: parsePositiveInt(env.VITE_ALIYUN_ONLINE_WINDOW_MINUTES, 5),
  mqtt: {
    enabled: parseBoolean(env.VITE_ALIYUN_MQTT_ENABLED, false),
    runtime: normalizeMqttRuntime(env.VITE_ALIYUN_MQTT_RUNTIME || 'native'),
    brokerUrl: safeTrim(env.VITE_ALIYUN_MQTT_BROKER_URL || ''),
    topics: parseDeviceList(env.VITE_ALIYUN_MQTT_TOPICS || ''),
    clientId: safeTrim(env.VITE_ALIYUN_MQTT_CLIENT_ID || ''),
    username: safeTrim(env.VITE_ALIYUN_MQTT_USERNAME || ''),
    password: safeTrim(env.VITE_ALIYUN_MQTT_PASSWORD || ''),
    reconnectPeriod: parsePositiveInt(env.VITE_ALIYUN_MQTT_RECONNECT_PERIOD, 3000),
    connectTimeout: parsePositiveInt(env.VITE_ALIYUN_MQTT_CONNECT_TIMEOUT, 10000),
    protocolVersion: parsePositiveInt(env.VITE_ALIYUN_MQTT_PROTOCOL_VERSION, 4)
  }
})

export function getAliyunIotEndpoint() {
  if (aliyunIotConfig.endpoint) {
    return aliyunIotConfig.endpoint
  }

  return `https://iot.${aliyunIotConfig.regionId}.aliyuncs.com/`
}

export function isAliyunIotConfigured() {
  return getAliyunIotMissingFields().length === 0
}

export function isAliyunMqttConfigured() {
  return getAliyunMqttMissingFields().length === 0
}

export function getAliyunIotMissingFields() {
  const missingFields = []

  if (!hasRealValue(aliyunIotConfig.accessKeyId)) missingFields.push('VITE_ALIYUN_ACCESS_KEY_ID')
  if (!hasRealValue(aliyunIotConfig.accessKeySecret)) missingFields.push('VITE_ALIYUN_ACCESS_KEY_SECRET')
  if (!aliyunIotConfig.productKey) missingFields.push('VITE_ALIYUN_PRODUCT_KEY')
  if (!aliyunIotConfig.devices.length) missingFields.push('VITE_ALIYUN_DEVICES')

  return missingFields
}

export function getAliyunMqttMissingFields() {
  const missingFields = []

  if (!aliyunIotConfig.mqtt.enabled) missingFields.push('VITE_ALIYUN_MQTT_ENABLED')
  if (!aliyunIotConfig.mqtt.brokerUrl) missingFields.push('VITE_ALIYUN_MQTT_BROKER_URL')
  if (!aliyunIotConfig.mqtt.topics.length) missingFields.push('VITE_ALIYUN_MQTT_TOPICS')
  if (!aliyunIotConfig.mqtt.clientId) missingFields.push('VITE_ALIYUN_MQTT_CLIENT_ID')
  if (!aliyunIotConfig.mqtt.username) missingFields.push('VITE_ALIYUN_MQTT_USERNAME')
  if (!aliyunIotConfig.mqtt.password) missingFields.push('VITE_ALIYUN_MQTT_PASSWORD')

  return missingFields
}

function normalizeEndpoint(value) {
  const trimmed = safeTrim(value)
  if (!trimmed) return ''
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

function parseDeviceList(value) {
  return safeTrim(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeQueryMode(value) {
  const normalized = safeTrim(value).toLowerCase()
  return normalized === 'original' ? 'original' : 'standard'
}

function normalizeMqttRuntime(value) {
  const normalized = safeTrim(value).toLowerCase()
  return ['always', 'native', 'web'].includes(normalized) ? normalized : 'native'
}

function parseBoolean(value, fallback) {
  const normalized = safeTrim(value).toLowerCase()
  if (!normalized) return fallback
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function hasRealValue(value) {
  const normalized = safeTrim(value).toLowerCase()
  return Boolean(normalized && !normalized.startsWith('your-'))
}

function safeTrim(value) {
  return value == null ? '' : String(value).trim()
}
