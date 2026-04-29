import { getLatestEmotion } from '../services/telemetry-service.js'
import { enrichEmotionWithAiAdvice } from '../services/deepseek-service.js'

export function registerEmotionRoutes(router) {
  router.get('/emotion/latest', async (_request, response, next) => {
    try {
      response.json(await getLatestEmotion())
    } catch (error) {
      next(error)
    }
  })

  router.post('/emotion/advice', async (request, response, next) => {
    try {
      const payload = request.body && typeof request.body === 'object' ? request.body : {}
      response.json(
        await enrichEmotionWithAiAdvice({
          source: typeof payload.source === 'string' ? payload.source : 'manual',
          currentMood: typeof payload.currentMood === 'string' ? payload.currentMood : '',
          score: Number.isFinite(Number(payload.score)) ? Number(payload.score) : null,
          summary: typeof payload.summary === 'string' ? payload.summary : '',
          suggestions: Array.isArray(payload.suggestions) ? payload.suggestions : [],
          voice: payload.voice && typeof payload.voice === 'object' ? payload.voice : { frequency: [], tone: [] },
          fluctuation:
            payload.fluctuation && typeof payload.fluctuation === 'object'
              ? payload.fluctuation
              : { timeline: [], values: [] },
          history: Array.isArray(payload.history) ? payload.history : [],
          createdAt: Number.isFinite(Number(payload.createdAt)) ? Number(payload.createdAt) : Date.now()
        })
      )
    } catch (error) {
      next(error)
    }
  })
}
