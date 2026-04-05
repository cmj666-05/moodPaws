import { getEmotionPayload } from '../services/emotion-service.js'

export function registerEmotionRoutes(router) {
  router.get('/emotion/latest', async (_request, response, next) => {
    try {
      response.json(await getEmotionPayload())
    } catch (error) {
      next(error)
    }
  })
}
