import { run } from './sqlite.js'

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS mqtt_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    device_name TEXT,
    request_id TEXT,
    gmt_create INTEGER,
    payload_json TEXT NOT NULL,
    received_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mqtt_messages_received_at ON mqtt_messages(received_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_mqtt_messages_request_id ON mqtt_messages(request_id)`,
  `CREATE TABLE IF NOT EXISTS metric_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    metric_key TEXT NOT NULL,
    value_num REAL,
    value_text TEXT,
    ts INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES mqtt_messages(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_metric_points_metric_key_ts ON metric_points(metric_key, ts DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_metric_points_message_id ON metric_points(message_id)`,
  `CREATE TABLE IF NOT EXISTS emotion_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    mood_label TEXT NOT NULL,
    score REAL,
    summary_json TEXT,
    created_at INTEGER NOT NULL
  )`
]

export async function initSchema() {
  for (const statement of schemaStatements) {
    await run(statement)
  }
}
