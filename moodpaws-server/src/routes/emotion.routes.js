import { getLatestEmotion } from '../services/telemetry-service.js'

export function registerEmotionRoutes(router) {
  router.get('/emotion/latest', async (_request, response, next) => {
    try {
      response.json(await getLatestEmotion())
    } catch (error) {
      next(error)
    }
  })
}
