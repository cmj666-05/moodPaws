import { all, get, run } from '../sqlite.js'

export async function seedDefaultEmotionSnapshot() {
  const existing = await get('SELECT id FROM emotion_snapshots ORDER BY created_at DESC LIMIT 1')
  if (existing) {
    return
  }

  const summary = {
    voice: {
      frequency: [9, 16, 24, 13, 5, 8, 13, 18, 11, 3],
      tone: [16, 13, 11, 7, 5, 7, 9, 13, 18, 20]
    },
    fluctuation: {
      timeline: ['清晨', '上午', '中午', '午后', '傍晚', '晚上', '深夜'],
      values: [46, 40, 32, 36, 52, 66, 74]
    },
    history: [
      { label: '晨间情绪', value: '平静' },
      { label: '午后活力', value: '偏高' },
      { label: '夜间状态', value: '放松' }
    ]
  }

  await run(
    `INSERT INTO emotion_snapshots (source, mood_label, score, summary_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    ['mock', '开心', 68, JSON.stringify(summary), Date.now()]
  )
}

export function getLatestEmotionSnapshot() {
  return get(
    `SELECT id, source, mood_label, score, summary_json, created_at
     FROM emotion_snapshots
     ORDER BY created_at DESC
     LIMIT 1`
  )
}

export function listEmotionSnapshots(limit) {
  return all(
    `SELECT id, source, mood_label, score, created_at
     FROM emotion_snapshots
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  )
}
