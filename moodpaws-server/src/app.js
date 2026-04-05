import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { healthHandler } from './routes/health.routes.js'
import { registerTelemetryRoutes } from './routes/telemetry.routes.js'
import { registerEmotionRoutes } from './routes/emotion.routes.js'

export function createApp({ mqttState }) {
  const app = express()
  const api = express.Router()

  app.use(cors({ origin: env.corsOrigin }))
  app.use(express.json({ limit: '1mb' }))

  api.get('/health', healthHandler({ mqttState, dbPath: env.dbPath }))
  registerTelemetryRoutes(api)
  registerEmotionRoutes(api)

  app.use('/api', api)

  app.use((error, _request, response, _next) => {
    response.status(500).json({
      ok: false,
      error: error.message || 'Internal Server Error'
    })
  })

  return app
}
