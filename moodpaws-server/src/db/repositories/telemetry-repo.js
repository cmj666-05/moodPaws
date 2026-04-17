import { env } from '../../config/env.js'
import { getMemoryState } from '../memory-store.js'
import { all, get, run } from '../sqlite.js'

export async function insertMessage({ topic, deviceName, requestId, gmtCreate, payloadJson, receivedAt }) {
  if (env.dataMode !== 'sqlite') {
    const state = getMemoryState()
    const nextId = (state.mqttMessages.at(-1)?.id ?? 0) + 1
    state.mqttMessages.push({
      id: nextId,
      topic,
      device_name: deviceName,
      request_id: requestId,
      gmt_create: gmtCreate,
      payload_json: payloadJson,
      received_at: receivedAt
    })
    return nextId
  }

  const result = await run(
    `INSERT INTO mqtt_messages (topic, device_name, request_id, gmt_create, payload_json, received_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [topic, deviceName, requestId, gmtCreate, payloadJson, receivedAt]
  )

  return result.lastID
}

export async function insertMetricPoints(messageId, metricPoints) {
  if (env.dataMode !== 'sqlite') {
    const state = getMemoryState()
    let nextId = (state.metricPoints.at(-1)?.id ?? 0) + 1

    for (const point of metricPoints) {
      state.metricPoints.push({
        id: nextId,
        message_id: messageId,
        metric_key: point.metricKey,
        value_num: point.valueNum,
        value_text: point.valueText,
        ts: point.ts
      })
      nextId += 1
    }
    return
  }

  for (const point of metricPoints) {
    await run(
      `INSERT INTO metric_points (message_id, metric_key, value_num, value_text, ts)
       VALUES (?, ?, ?, ?, ?)`,
      [messageId, point.metricKey, point.valueNum, point.valueText, point.ts]
    )
  }
}

export function getLatestMessage() {
  if (env.dataMode !== 'sqlite') {
    const state = getMemoryState()
    return Promise.resolve([...state.mqttMessages].sort((a, b) => b.received_at - a.received_at)[0] ?? null)
  }

  return get(
    `SELECT id, topic, device_name, request_id, gmt_create, payload_json, received_at
     FROM mqtt_messages
     ORDER BY received_at DESC
     LIMIT 1`
  )
}

export function getLatestMessageByDeviceName(deviceName) {
  if (env.dataMode !== 'sqlite') {
    const state = getMemoryState()
    return Promise.resolve(
      [...state.mqttMessages]
        .filter((row) => row.device_name === deviceName)
        .sort((a, b) => b.received_at - a.received_at)[0] ?? null
    )
  }

  return get(
    `SELECT id, topic, device_name, request_id, gmt_create, payload_json, received_at
     FROM mqtt_messages
     WHERE device_name = ?
     ORDER BY received_at DESC
     LIMIT 1`,
    [deviceName]
  )
}

export function listLatestMetricPoints(metricKeys) {
  if (!Array.isArray(metricKeys) || metricKeys.length === 0) {
    return Promise.resolve([])
  }

  if (env.dataMode !== 'sqlite') {
    const state = getMemoryState()
    const rows = metricKeys
      .map((metricKey) =>
        [...state.metricPoints]
          .filter((row) => row.metric_key === metricKey)
          .sort((a, b) => b.ts - a.ts)[0]
      )
      .filter(Boolean)
    return Promise.resolve(rows)
  }

  const placeholders = metricKeys.map(() => '?').join(', ')

  return all(
    `SELECT metric_key, value_num, value_text, ts
     FROM metric_points AS current
     WHERE current.metric_key IN (${placeholders})
       AND current.ts = (
         SELECT MAX(latest.ts)
         FROM metric_points AS latest
         WHERE latest.metric_key = current.metric_key
       )
     ORDER BY current.ts DESC`,
    metricKeys
  )
}

export function listRecentMessages(limit) {
  if (env.dataMode !== 'sqlite') {
    const state = getMemoryState()
    return Promise.resolve(
      [...state.mqttMessages]
        .sort((a, b) => b.received_at - a.received_at)
        .slice(0, limit)
        .map(({ id, topic, device_name, request_id, gmt_create, received_at }) => ({
          id,
          topic,
          device_name,
          request_id,
          gmt_create,
          received_at
        }))
    )
  }

  return all(
    `SELECT id, topic, device_name, request_id, gmt_create, received_at
     FROM mqtt_messages
     ORDER BY received_at DESC
     LIMIT ?`,
    [limit]
  )
}

export function listMetricHistory(metricKey, limit) {
  if (env.dataMode !== 'sqlite') {
    const state = getMemoryState()
    return Promise.resolve(
      [...state.metricPoints]
        .filter((row) => row.metric_key === metricKey)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, limit)
    )
  }

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
  if (env.dataMode !== 'sqlite') {
    const state = getMemoryState()
    const messageMap = new Map(state.metricPoints.map((row) => [`${row.message_id}:${row.metric_key}`, row]))
    const rows = [...state.metricPoints]
      .filter((row) => row.metric_key === 'Longitude' && row.value_num !== null && row.ts >= sinceTs)
      .map((longitude) => {
        const latitude = messageMap.get(`${longitude.message_id}:Latitude`)
        return latitude?.value_num == null
          ? null
          : { longitude: longitude.value_num, latitude: latitude.value_num, ts: longitude.ts }
      })
      .filter(Boolean)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit)
    return Promise.resolve(rows)
  }

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
  if (env.dataMode !== 'sqlite') {
    const state = getMemoryState()
    const messageMap = new Map(state.metricPoints.map((row) => [`${row.message_id}:${row.metric_key}`, row]))
    const rows = [...state.metricPoints]
      .filter((row) => row.metric_key === 'X' && row.value_num !== null)
      .map((x) => {
        const y = messageMap.get(`${x.message_id}:Y`)
        const z = messageMap.get(`${x.message_id}:Z`)
        if (y?.value_num == null || z?.value_num == null) {
          return null
        }
        return { x: x.value_num, y: y.value_num, z: z.value_num, ts: x.ts }
      })
      .filter(Boolean)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit)
    return Promise.resolve(rows)
  }

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
