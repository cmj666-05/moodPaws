import { insertMessage, insertMetricPoints } from '../db/repositories/telemetry-repo.js'
import { parsePayloadText } from './parser.js'

export async function consumeMessage(topic, payload) {
  const payloadText = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload)
  const parsed = parsePayloadText(payloadText, topic)
  const receivedAt = Date.now()
  const messageId = await insertMessage({
    topic,
    deviceName: parsed.source.deviceName,
    requestId: parsed.source.requestId,
    gmtCreate: parsed.source.createdAt,
    deviceType: parsed.source.deviceType,
    iotId: parsed.source.iotId,
    productKey: parsed.source.productKey,
    checkFailedDataJson: parsed.checkFailedData ? JSON.stringify(parsed.checkFailedData) : null,
    payloadJson: payloadText,
    receivedAt
  })

  await insertMetricPoints(messageId, parsed.metricPoints)

  return {
    messageId,
    metricPoints: parsed.metricPoints.length
  }
}
