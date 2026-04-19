import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
dotenv.config({ path: path.join(rootDir, '.env') })

function toBoolean(value, fallback = false) {
  if (value === undefined) return fallback
  return value === '1' || value === 'true' || value === 'yes'
}

function toNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizePath(value, fallback) {
  const resolved = (value || fallback || '').trim()
  if (!resolved) return fallback
  return resolved.startsWith('/') ? resolved : `/${resolved}`
}

function normalizeUrl(value) {
  const resolved = (value || '').trim()
  if (!resolved) return ''
  return resolved.replace(/\/+$/, '')
}

const defaultDbPath = path.join(rootDir, 'data', 'moodpaws.db')

const topics = (process.env.MQTT_TOPICS || '/k1wxaEnEO8L/petInfo/user/get')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

export const env = {
  port: toNumber(process.env.PORT, 3001),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  dataMode: process.env.DATA_MODE === 'sqlite' ? 'sqlite' : 'memory',
  dbPath: process.env.DB_PATH || defaultDbPath,
  service: {
    id: process.env.SERVICE_ID || '',
    name: process.env.MDNS_SERVICE_NAME || 'moodpaws-server',
    mdnsEnabled: toBoolean(process.env.MDNS_ENABLED, true),
    healthPath: '/api/health'
  },
  video: {
    enabled: toBoolean(process.env.VIDEO_STREAM_ENABLED, true),
    url: normalizeUrl(process.env.VIDEO_STREAM_URL),
    origin: normalizeUrl(process.env.VIDEO_STREAM_ORIGIN),
    host: (process.env.VIDEO_STREAM_HOST || '').trim(),
    port: toNumber(process.env.VIDEO_STREAM_PORT, 5000),
    path: normalizePath(process.env.VIDEO_STREAM_PATH, '/video_feed')
  },
  mqtt: {
    enabled: toBoolean(process.env.ENABLE_MQTT, false),
    brokerUrl: process.env.MQTT_BROKER_URL || '',
    topics,
    clientId: process.env.MQTT_CLIENT_ID || `moodpaws-server-${process.pid}`,
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    reconnectPeriod: toNumber(process.env.MQTT_RECONNECT_PERIOD, 3000),
    connectTimeout: toNumber(process.env.MQTT_CONNECT_TIMEOUT, 10000),
    protocolVersion: toNumber(process.env.MQTT_PROTOCOL_VERSION, 4)
  }
}
