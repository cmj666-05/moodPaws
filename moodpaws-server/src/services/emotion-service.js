import { getLatestEmotion } from './telemetry-service.js'

export async function getEmotionPayload() {
  return getLatestEmotion()
}
