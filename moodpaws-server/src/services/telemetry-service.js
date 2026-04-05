import { getLatestEmotionSnapshot } from '../db/repositories/emotion-repo.js'
import { getLatestMessage, listMetricHistory, listRecentMessages, listTrackPoints } from '../db/repositories/telemetry-repo.js'
import { parsePayloadObject } from '../mqtt/parser.js'

export async function getLatestTelemetry() {
  const latestMessage = await getLatestMessage()

  if (!latestMessage) {
    return {
      source: {
        deviceName: '--',
        requestId: '--',
        createdAt: null
      },
      sections: []
    }
  }

  const parsed = parsePayloadObject(JSON.parse(latestMessage.payload_json), latestMessage.topic)
  return {
    source: parsed.source,
    sections: parsed.sections,
    raw: parsed.raw,
    receivedAt: latestMessage.received_at,
    topic: latestMessage.topic
  }
}

export async function getRecentMessages(limit = 50) {
  return listRecentMessages(limit)
}

export async function getMetricHistory(metricKey, limit = 100) {
  const rows = await listMetricHistory(metricKey, limit)
  return {
    metricKey,
    points: rows
      .map((row) => ({
        value: row.value_num ?? row.value_text,
        time: row.ts
      }))
      .reverse()
  }
}

export async function getLocationTrack(limit = 200) {
  const rows = await listTrackPoints(limit)
  return {
    points: rows
      .map((row) => ({
        longitude: row.longitude,
        latitude: row.latitude,
        time: row.ts
      }))
      .reverse()
  }
}

export async function getLatestEmotion() {
  const snapshot = await getLatestEmotionSnapshot()

  if (!snapshot) {
    return {
      source: 'mock',
      currentMood: '开心',
      score: 68,
      voice: {
        frequency: [],
        tone: []
      },
      fluctuation: {
        timeline: [],
        values: []
      },
      history: [],
      createdAt: null
    }
  }

  const summary = JSON.parse(snapshot.summary_json || '{}')

  return {
    source: snapshot.source,
    currentMood: snapshot.mood_label,
    score: snapshot.score,
    voice: summary.voice || { frequency: [], tone: [] },
    fluctuation: summary.fluctuation || { timeline: [], values: [] },
    history: summary.history || [],
    createdAt: snapshot.created_at
  }
}
