import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..', '..')

dotenv.config({ path: path.join(rootDir, '.env') })

const defaultDbPath = path.join(rootDir, 'data', 'moodpaws.db')

function toAbsolutePath(targetPath) {
  if (!targetPath) return defaultDbPath
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(rootDir, targetPath)
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  dbPath: toAbsolutePath(process.env.DB_PATH),
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || '',
    topics: (process.env.MQTT_TOPICS || process.env.MQTT_TOPIC || '')
      .split(',')
      .map((topic) => topic.trim())
      .filter(Boolean),
    clientId: process.env.MQTT_CLIENT_ID || '',
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    reconnectPeriod: Number(process.env.MQTT_RECONNECT_PERIOD || 3000),
    connectTimeout: Number(process.env.MQTT_CONNECT_TIMEOUT || 10000),
    protocolVersion: Number(process.env.MQTT_PROTOCOL_VERSION || 4)
  }
}
