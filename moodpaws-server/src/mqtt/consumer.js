import { parsePayloadText } from './parser.js'
import { insertMessage, insertMetricPoints } from '../db/repositories/telemetry-repo.js'

export async function consumeMessage(topic, payloadBuffer) {
  const receivedAt = Date.now()
  const payloadText = payloadBuffer.toString()
  const parsed = parsePayloadText(payloadText, topic)

  const messageId = await insertMessage({
    topic,
    deviceName: parsed.source.deviceName,
    requestId: parsed.source.requestId,
    gmtCreate: parsed.source.createdAt,
    payloadJson: payloadText,
    receivedAt
  })

  await insertMetricPoints(messageId, parsed.metricPoints)

  return {
    messageId,
    parsed,
    receivedAt
  }
}
