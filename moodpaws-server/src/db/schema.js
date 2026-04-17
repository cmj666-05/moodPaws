import { env } from '../config/env.js'
import { buildDemoState } from './memory-store.js'
import { exec, get, run } from './sqlite.js'

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
      payload_json TEXT NOT NULL,
      received_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metric_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      metric_key TEXT NOT NULL,
      value_num REAL,
      value_text TEXT,
      ts INTEGER NOT NULL,
      FOREIGN KEY (message_id) REFERENCES mqtt_messages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS emotion_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      mood_label TEXT NOT NULL,
      score INTEGER NOT NULL,
      summary_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)

  const row = await get('SELECT COUNT(*) AS count FROM mqtt_messages')
  if ((row?.count ?? 0) > 0) {
    return
  }

  const demo = buildDemoState()

  for (const message of demo.mqttMessages) {
    await run(
      `INSERT INTO mqtt_messages (topic, device_name, request_id, gmt_create, payload_json, received_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [message.topic, message.device_name, message.request_id, message.gmt_create, message.payload_json, message.received_at]
    )
  }

  for (const point of demo.metricPoints) {
    await run(
      `INSERT INTO metric_points (message_id, metric_key, value_num, value_text, ts)
       VALUES (?, ?, ?, ?, ?)`,
      [point.message_id, point.metric_key, point.value_num, point.value_text, point.ts]
    )
  }

  for (const snapshot of demo.emotionSnapshots) {
    await run(
      `INSERT INTO emotion_snapshots (source, mood_label, score, summary_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [snapshot.source, snapshot.mood_label, snapshot.score, snapshot.summary_json, snapshot.created_at]
    )
  }
}
