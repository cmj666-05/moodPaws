import { getLocationTrack, getLatestTelemetry, getMetricHistory, getRecentMessages } from '../services/telemetry-service.js'

function parseLimit(rawValue, fallback) {
  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, 500)
}

export function registerTelemetryRoutes(router) {
  router.get('/telemetry/latest', async (_request, response, next) => {
    try {
      response.json(await getLatestTelemetry())
    } catch (error) {
      next(error)
    }
  })

  router.get('/telemetry/messages', async (request, response, next) => {
    try {
      const limit = parseLimit(request.query.limit, 50)
      response.json({ messages: await getRecentMessages(limit) })
    } catch (error) {
      next(error)
    }
  })

  router.get('/telemetry/metrics/:metricKey/history', async (request, response, next) => {
    try {
      const limit = parseLimit(request.query.limit, 100)
      response.json(await getMetricHistory(request.params.metricKey, limit))
    } catch (error) {
      next(error)
    }
  })

  router.get('/telemetry/location/track', async (request, response, next) => {
    try {
      const limit = parseLimit(request.query.limit, 200)
      response.json(await getLocationTrack(limit))
    } catch (error) {
      next(error)
    }
  })
}
