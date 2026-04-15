import { all, get, run } from '../sqlite.js'

export async function insertMessage({ topic, deviceName, requestId, gmtCreate, payloadJson, receivedAt }) {
  const result = await run(
    `INSERT INTO mqtt_messages (topic, device_name, request_id, gmt_create, payload_json, received_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [topic, deviceName, requestId, gmtCreate, payloadJson, receivedAt]
  )

  return result.lastID
}

export async function insertMetricPoints(messageId, metricPoints) {
  for (const point of metricPoints) {
    await run(
      `INSERT INTO metric_points (message_id, metric_key, value_num, value_text, ts)
       VALUES (?, ?, ?, ?, ?)`,
      [messageId, point.metricKey, point.valueNum, point.valueText, point.ts]
    )
  }
}

export function getLatestMessage() {
  return get(
    `SELECT id, topic, device_name, request_id, gmt_create, payload_json, received_at
     FROM mqtt_messages
     ORDER BY received_at DESC
     LIMIT 1`
  )
}

export function getLatestMessageByDeviceName(deviceName) {
  return get(
    `SELECT id, topic, device_name, request_id, gmt_create, payload_json, received_at
     FROM mqtt_messages
     WHERE device_name = ?
     ORDER BY received_at DESC
     LIMIT 1`,
    [deviceName]
  )
}

export function listRecentMessages(limit) {
  return all(
    `SELECT id, topic, device_name, request_id, gmt_create, received_at
     FROM mqtt_messages
     ORDER BY received_at DESC
     LIMIT ?`,
    [limit]
  )
}

export function listMetricHistory(metricKey, limit) {
  return all(
    `SELECT metric_key, value_num, value_text, ts
     FROM metric_points
     WHERE metric_key = ?
     ORDER BY ts DESC
     LIMIT ?`,
    [metricKey, limit]
  )
}

export function listTrackPoints(limit, sinceTs) {
  return all(
    `SELECT longitude.value_num AS longitude, latitude.value_num AS latitude, longitude.ts AS ts
     FROM metric_points AS longitude
     JOIN metric_points AS latitude
       ON latitude.message_id = longitude.message_id
      AND latitude.metric_key = 'Latitude'
     WHERE longitude.metric_key = 'Longitude'
       AND longitude.value_num IS NOT NULL
       AND latitude.value_num IS NOT NULL
       AND longitude.value_num BETWEEN -180 AND 180
       AND latitude.value_num BETWEEN -90 AND 90
       AND longitude.ts >= ?
     ORDER BY longitude.ts DESC
     LIMIT ?`,
    [sinceTs, limit]
  )
}

export function listRecentMotionSamples(limit) {
  return all(
    `SELECT x.value_num AS x, y.value_num AS y, z.value_num AS z, x.ts AS ts
     FROM metric_points AS x
     JOIN metric_points AS y
       ON y.message_id = x.message_id
      AND y.metric_key = 'Y'
     JOIN metric_points AS z
       ON z.message_id = x.message_id
      AND z.metric_key = 'Z'
     WHERE x.metric_key = 'X'
       AND x.value_num IS NOT NULL
       AND y.value_num IS NOT NULL
       AND z.value_num IS NOT NULL
     ORDER BY x.ts DESC
     LIMIT ?`,
    [limit]
  )
}
