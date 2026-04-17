import { env } from '../../config/env.js'
import { getMemoryState } from '../memory-store.js'
import { get as sqliteGet, run as sqliteRun } from '../sqlite.js'

export function getLatestEmotionSnapshot() {
  if (env.dataMode !== 'sqlite') {
    const state = getMemoryState()
    return Promise.resolve(state.emotionSnapshots.at(-1) ?? null)
  }

  return sqliteGet(
    `SELECT id, source, mood_label, score, summary_json, created_at
     FROM emotion_snapshots
     ORDER BY created_at DESC, id DESC
     LIMIT 1`
  )
}

export async function seedDefaultEmotionSnapshot() {
  const existing = await getLatestEmotionSnapshot()
  if (existing) {
    return existing
  }

  const snapshot = {
    source: 'mock',
    mood_label: '开心',
    score: 68,
    summary_json: JSON.stringify({
      voice: { frequency: [10, 12, 15, 18], tone: [9, 11, 12, 14] },
      fluctuation: { timeline: ['06:00', '12:00', '18:00', '24:00'], values: [55, 66, 74, 69] },
      history: [
        { label: '主情绪', value: '开心' },
        { label: '稳定度', value: '良好' }
      ]
    }),
    created_at: Date.now()
  }

  if (env.dataMode !== 'sqlite') {
    const state = getMemoryState()
    state.emotionSnapshots.push({ id: state.emotionSnapshots.length + 1, ...snapshot })
    return state.emotionSnapshots.at(-1)
  }

  await sqliteRun(
    `INSERT INTO emotion_snapshots (source, mood_label, score, summary_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [snapshot.source, snapshot.mood_label, snapshot.score, snapshot.summary_json, snapshot.created_at]
  )

  return getLatestEmotionSnapshot()
}
