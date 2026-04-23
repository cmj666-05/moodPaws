import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'

const DATABASE_NAME = 'moodpaws_data'
const FALLBACK_STORAGE_KEY = 'moodpaws.localStore.v1'
const MAX_FALLBACK_POINTS = 6000

let initPromise = null
let sqliteConnection = null
let database = null
let isNativeSqliteReady = false
let fallbackState = null

export const petLocalStore = {
  init,
  isUsingSqlite,
  upsertMetricPoints,
  getLatestMetricPoints,
  getLatestMetricPoint,
  getMetricHistory,
  getLocationTrack,
  getMotionSamplesSince,
  getMeta,
  setMeta
}

async function init() {
  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    if (!shouldUseNativeSqlite()) {
      fallbackState = loadFallbackState()
      return
    }

    try {
      sqliteConnection = new SQLiteConnection(CapacitorSQLite)
      const hasConnection = await sqliteConnection
        .isConnection(DATABASE_NAME, false)
        .catch(() => ({ result: false }))

      database = hasConnection.result
        ? await sqliteConnection.retrieveConnection(DATABASE_NAME, false)
        : await sqliteConnection.createConnection(DATABASE_NAME, false, 'no-encryption', 1, false)

      await database.open()
      await database.execute(createSchemaSql())
      isNativeSqliteReady = true
    } catch (error) {
      console.warn('[MoodPaws] SQLite 初始化失败，已退回到本地缓存模式。', error)
      isNativeSqliteReady = false
      database = null
      fallbackState = loadFallbackState()
    }
  })()

  return initPromise
}

function isUsingSqlite() {
  return isNativeSqliteReady
}

async function upsertMetricPoints(points = []) {
  await init()
  const normalizedPoints = points.filter((point) => point && point.metric_key && point.ts)

  if (!normalizedPoints.length) {
    return
  }

  if (isNativeSqliteReady) {
    await database.executeSet(
      normalizedPoints.map((point) => ({
        statement: `
          INSERT INTO metric_points (
            product_key,
            device_name,
            identifier,
            metric_key,
            label,
            section,
            unit,
            value_num,
            value_text,
            ts,
            raw_value,
            received_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(product_key, device_name, identifier, metric_key, ts)
          DO UPDATE SET
            label = excluded.label,
            section = excluded.section,
            unit = excluded.unit,
            value_num = excluded.value_num,
            value_text = excluded.value_text,
            raw_value = excluded.raw_value,
            received_at = excluded.received_at,
            updated_at = excluded.updated_at
        `,
        values: [
          point.product_key || '',
          point.device_name || '',
          point.identifier || '',
          point.metric_key,
          point.label || '',
          point.section || '',
          point.unit || '',
          point.value_num,
          point.value_text || '',
          Number(point.ts),
          point.raw_value || '',
          Number(point.received_at) || Date.now(),
          Date.now()
        ]
      })),
      true
    )
    return
  }

  const pointMap = new Map(
    fallbackState.metricPoints.map((point) => [createPointKey(point), point])
  )

  for (const point of normalizedPoints) {
    pointMap.set(createPointKey(point), {
      ...point,
      updated_at: Date.now()
    })
  }

  fallbackState.metricPoints = Array.from(pointMap.values())
    .sort((first, second) => Number(first.ts) - Number(second.ts))
    .slice(-MAX_FALLBACK_POINTS)
  persistFallbackState()
}

async function getLatestMetricPoints(limit = 300) {
  await init()

  if (isNativeSqliteReady) {
    const result = await database.query(
      `
        SELECT mp.*
        FROM metric_points mp
        INNER JOIN (
          SELECT product_key, device_name, metric_key, MAX(ts) AS latest_ts
          FROM metric_points
          GROUP BY product_key, device_name, metric_key
        ) latest
          ON latest.product_key = mp.product_key
         AND latest.device_name = mp.device_name
         AND latest.metric_key = mp.metric_key
         AND latest.latest_ts = mp.ts
        ORDER BY mp.ts DESC
        LIMIT ?
      `,
      [limit]
    )

    return result.values || []
  }

  const latestMap = new Map()
  for (const point of fallbackState.metricPoints) {
    const key = `${point.product_key}:${point.device_name}:${point.metric_key}`
    const previous = latestMap.get(key)
    if (!previous || Number(point.ts) >= Number(previous.ts)) {
      latestMap.set(key, point)
    }
  }

  return Array.from(latestMap.values())
    .sort((first, second) => Number(second.ts) - Number(first.ts))
    .slice(0, limit)
}

async function getLatestMetricPoint(metricKey) {
  await init()

  if (isNativeSqliteReady) {
    const result = await database.query(
      `
        SELECT *
        FROM metric_points
        WHERE metric_key = ?
        ORDER BY ts DESC
        LIMIT 1
      `,
      [metricKey]
    )

    return result.values?.[0] || null
  }

  return fallbackState.metricPoints
    .filter((point) => point.metric_key === metricKey)
    .sort((first, second) => Number(second.ts) - Number(first.ts))[0] || null
}

async function getMetricHistory(metricKey, limit = 100) {
  await init()
  const normalizedLimit = Math.max(1, Math.floor(Number(limit) || 100))

  if (isNativeSqliteReady) {
    const result = await database.query(
      `
        SELECT *
        FROM (
          SELECT *
          FROM metric_points
          WHERE metric_key = ?
          ORDER BY ts DESC
          LIMIT ?
        )
        ORDER BY ts ASC
      `,
      [metricKey, normalizedLimit]
    )

    return result.values || []
  }

  return fallbackState.metricPoints
    .filter((point) => point.metric_key === metricKey)
    .sort((first, second) => Number(second.ts) - Number(first.ts))
    .slice(0, normalizedLimit)
    .reverse()
}

async function getLocationTrack(limit = 200) {
  const rows = await getRecentMetricRows(
    ['Collar:GPS.Longitude', 'Collar:GPS.Latitude', 'Collar:GPS.Accuracy'],
    Math.max(50, Number(limit) * 3)
  )
  const grouped = new Map()

  for (const row of rows) {
    const timestamp = Number(row.ts)
    if (!grouped.has(timestamp)) {
      grouped.set(timestamp, { time: timestamp })
    }

    const point = grouped.get(timestamp)
    if (row.metric_key === 'Collar:GPS.Longitude') {
      point.longitude = toNumber(row.value_num ?? row.value_text)
    } else if (row.metric_key === 'Collar:GPS.Latitude') {
      point.latitude = toNumber(row.value_num ?? row.value_text)
    } else if (row.metric_key === 'Collar:GPS.Accuracy') {
      point.accuracy = toNumber(row.value_num ?? row.value_text)
    }
  }

  return Array.from(grouped.values())
    .filter((point) => Number.isFinite(point.longitude) && Number.isFinite(point.latitude))
    .sort((first, second) => Number(first.time) - Number(second.time))
    .slice(-Math.max(1, Number(limit) || 200))
}

async function getMotionSamplesSince(startTime) {
  await init()
  const metricKeys = ['Collar:BNO085.X', 'Collar:BNO085.Y', 'Collar:BNO085.Z']
  let rows = []

  if (isNativeSqliteReady) {
    const result = await database.query(
      `
        SELECT metric_key, value_num, value_text, ts
        FROM metric_points
        WHERE metric_key IN (?, ?, ?)
          AND ts >= ?
        ORDER BY ts ASC
        LIMIT 1500
      `,
      [...metricKeys, Number(startTime) || 0]
    )
    rows = result.values || []
  } else {
    rows = fallbackState.metricPoints
      .filter((point) => metricKeys.includes(point.metric_key) && Number(point.ts) >= Number(startTime || 0))
      .sort((first, second) => Number(first.ts) - Number(second.ts))
      .slice(-1500)
  }

  const grouped = new Map()
  for (const row of rows) {
    const timestamp = Number(row.ts)
    if (!grouped.has(timestamp)) {
      grouped.set(timestamp, { time: timestamp })
    }

    const sample = grouped.get(timestamp)
    const value = toNumber(row.value_num ?? row.value_text)
    if (row.metric_key.endsWith('.X')) sample.x = value
    if (row.metric_key.endsWith('.Y')) sample.y = value
    if (row.metric_key.endsWith('.Z')) sample.z = value
  }

  return Array.from(grouped.values())
    .filter((sample) => [sample.x, sample.y, sample.z].every(Number.isFinite))
    .sort((first, second) => Number(first.time) - Number(second.time))
}

async function getMeta(key) {
  await init()

  if (isNativeSqliteReady) {
    const result = await database.query('SELECT value FROM kv_store WHERE key = ? LIMIT 1', [key])
    return result.values?.[0]?.value || ''
  }

  return fallbackState.meta[key] || ''
}

async function setMeta(key, value) {
  await init()
  const valueText = value == null ? '' : String(value)

  if (isNativeSqliteReady) {
    await database.run(
      `
        INSERT INTO kv_store (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key)
        DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `,
      [key, valueText, Date.now()]
    )
    return
  }

  fallbackState.meta[key] = valueText
  persistFallbackState()
}

async function getRecentMetricRows(metricKeys, limit) {
  await init()

  if (isNativeSqliteReady) {
    const placeholders = metricKeys.map(() => '?').join(', ')
    const result = await database.query(
      `
        SELECT metric_key, value_num, value_text, ts
        FROM metric_points
        WHERE metric_key IN (${placeholders})
        ORDER BY ts DESC
        LIMIT ?
      `,
      [...metricKeys, limit]
    )
    return (result.values || []).reverse()
  }

  return fallbackState.metricPoints
    .filter((point) => metricKeys.includes(point.metric_key))
    .sort((first, second) => Number(second.ts) - Number(first.ts))
    .slice(0, limit)
    .reverse()
}

function shouldUseNativeSqlite() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('CapacitorSQLite')
}

function createSchemaSql() {
  return `
    CREATE TABLE IF NOT EXISTS metric_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_key TEXT NOT NULL,
      device_name TEXT NOT NULL,
      identifier TEXT NOT NULL,
      metric_key TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      section TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT '',
      value_num REAL,
      value_text TEXT,
      ts INTEGER NOT NULL,
      raw_value TEXT,
      received_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(product_key, device_name, identifier, metric_key, ts)
    );

    CREATE INDEX IF NOT EXISTS idx_metric_points_key_time
      ON metric_points(metric_key, ts);

    CREATE INDEX IF NOT EXISTS idx_metric_points_device_time
      ON metric_points(product_key, device_name, ts);

    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `
}

function loadFallbackState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createEmptyFallbackState()
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(FALLBACK_STORAGE_KEY) || '')
    return {
      metricPoints: Array.isArray(parsed?.metricPoints) ? parsed.metricPoints : [],
      meta: parsed?.meta && typeof parsed.meta === 'object' ? parsed.meta : {}
    }
  } catch {
    return createEmptyFallbackState()
  }
}

function persistFallbackState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(fallbackState))
}

function createEmptyFallbackState() {
  return {
    metricPoints: [],
    meta: {}
  }
}

function createPointKey(point) {
  return [
    point.product_key || '',
    point.device_name || '',
    point.identifier || '',
    point.metric_key || '',
    point.ts || ''
  ].join(':')
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
