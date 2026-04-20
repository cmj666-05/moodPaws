import { env } from '../config/env.js'
import { all, exec, get, run } from './sqlite.js'

export async function initSchema() {
  if (env.dataMode !== 'sqlite') {
    return
  }

  exec(`
    CREATE TABLE IF NOT EXISTS mqtt_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      device_name TEXT NOT NULL,
      request_id TEXT,
      gmt_create INTEGER,
      device_type TEXT,
      iot_id TEXT,
      product_key TEXT,
      check_failed_data_json TEXT,
      payload_json TEXT NOT NULL,
      received_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metric_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      metric_key TEXT NOT NULL,
      item_key TEXT,
      value_num REAL,
      value_text TEXT,
      ts INTEGER NOT NULL,
      FOREIGN KEY (message_id) REFERENCES mqtt_messages(id) ON DELETE CASCADE
    );
  `)

  await ensureColumn('mqtt_messages', 'device_type TEXT')
  await ensureColumn('mqtt_messages', 'iot_id TEXT')
  await ensureColumn('mqtt_messages', 'product_key TEXT')
  await ensureColumn('mqtt_messages', 'check_failed_data_json TEXT')
  await ensureColumn('metric_points', 'item_key TEXT')

  await backfillMessageColumns()
  await backfillMetricItemKeys()
  await removeSeededDemoRows()
  await clearMockEmotionSnapshots()
}

async function ensureColumn(tableName, columnDefinition) {
  const [columnName] = columnDefinition.split(' ')
  const columns = await all(`PRAGMA table_info(${tableName})`)
  if (columns.some((column) => column.name === columnName)) {
    return
  }

  exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`)
}

async function backfillMessageColumns() {
  const rows = await all(`
    SELECT id, payload_json, device_type, iot_id, product_key, check_failed_data_json
    FROM mqtt_messages
    WHERE device_type IS NULL
       OR iot_id IS NULL
       OR product_key IS NULL
       OR check_failed_data_json IS NULL
  `)

  for (const row of rows) {
    let payload = null
    try {
      payload = JSON.parse(row.payload_json)
    } catch {
      payload = null
    }

    await run(
      `UPDATE mqtt_messages
       SET device_type = ?,
           iot_id = ?,
           product_key = ?,
           check_failed_data_json = ?
       WHERE id = ?`,
      [
        payload?.deviceType ?? null,
        payload?.iotId ?? null,
        payload?.productKey ?? null,
        payload?.checkFailedData ? JSON.stringify(payload.checkFailedData) : null,
        row.id
      ]
    )
  }
}

async function backfillMetricItemKeys() {
  await run(`UPDATE metric_points SET item_key = 'Collar:XYZ' WHERE item_key IS NULL AND metric_key IN ('X', 'Y', 'Z')`)
  await run(`UPDATE metric_points SET item_key = 'Collar:GPS' WHERE item_key IS NULL AND metric_key IN ('Longitude', 'Latitude')`)
  await run(`UPDATE metric_points SET item_key = 'Collar:XKXY' WHERE item_key IS NULL AND metric_key IN ('HeartRate', 'SPO2')`)
  await run(`UPDATE metric_points SET item_key = metric_key WHERE item_key IS NULL`)
}

async function removeSeededDemoRows() {
  await run(`
    DELETE FROM mqtt_messages
    WHERE request_id LIKE 'collar-%'
       OR request_id LIKE 'doghouse-%'
  `)
}

async function clearMockEmotionSnapshots() {
  const table = await get(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = 'emotion_snapshots'
  `)

  if (!table) {
    return
  }

  await run(`DELETE FROM emotion_snapshots WHERE source = 'mock'`)
}
