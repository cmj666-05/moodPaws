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
