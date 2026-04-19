import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { registerTelemetryRoutes } from './routes/telemetry.routes.js'
import { registerEmotionRoutes } from './routes/emotion.routes.js'

export function createApp({ mqttState, serviceState }) {
  const app = express()
  const api = express.Router()

  app.use(cors({ origin: env.corsOrigin }))
  app.use(express.json())

  api.get('/health', (_request, response) => {
    response.json({
      ok: true,
      service: 'moodpaws-server',
      serviceId: serviceState.serviceId,
      port: env.port,
      dataMode: env.dataMode,
      video: {
        enabled: env.video.enabled,
        url: env.video.url,
        origin: env.video.origin,
        host: env.video.host,
        port: env.video.port,
        path: env.video.path
      },
      discovery: {
        ...serviceState.discovery
      },
      mqtt: {
        enabled: mqttState.enabled,
        connected: mqttState.connected,
        subscribed: mqttState.subscribed,
        topics: mqttState.topics,
        lastMessageAt: mqttState.lastMessageAt,
        lastError: mqttState.lastError,
        lastEvent: mqttState.lastEvent,
        lastConnackCode: mqttState.lastConnackCode,
        lastDisconnectPacket: mqttState.lastDisconnectPacket,
        lastSubscribeGranted: mqttState.lastSubscribeGranted
      }
    })
  })

  registerTelemetryRoutes(api)
  registerEmotionRoutes(api)
  app.use('/api', api)

  app.use((error, _request, response, _next) => {
    response.status(500).json({
      message: error instanceof Error ? error.message : 'Internal Server Error'
    })
  })

  return app
}
