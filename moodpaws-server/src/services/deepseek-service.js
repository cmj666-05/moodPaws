import OpenAI from 'openai'
import { env } from '../config/env.js'

const DEFAULT_ADVICE_TTL_MS = 5 * 60 * 1000
const adviceCache = new Map()

const deepseekClient = env.deepseek.apiKey
  ? new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: env.deepseek.apiKey
    })
  : null

export async function enrichEmotionWithAiAdvice(emotionPayload) {
  if (!deepseekClient) {
    return withAdviceSource(emotionPayload, 'fallback')
  }

  const currentMood = safeTrim(emotionPayload?.currentMood)
  if (!currentMood) {
    return withAdviceSource(emotionPayload, 'fallback')
  }

  const cacheKey = JSON.stringify({
    currentMood,
    score: normalizeNumber(emotionPayload?.score),
    history: Array.isArray(emotionPayload?.history) ? emotionPayload.history : []
  })
  const cached = adviceCache.get(cacheKey)
  const now = Date.now()

  if (cached && now - cached.createdAt < DEFAULT_ADVICE_TTL_MS) {
    return {
      ...emotionPayload,
      summary: cached.summary || emotionPayload.summary,
      suggestions: cached.suggestions.length ? cached.suggestions : emotionPayload.suggestions,
      adviceSource: 'deepseek-cache'
    }
  }

  try {
    const aiResult = await generateEmotionAdvice({
      currentMood,
      score: emotionPayload?.score,
      history: emotionPayload?.history || [],
      fallbackSummary: emotionPayload?.summary || '',
      fallbackSuggestions: Array.isArray(emotionPayload?.suggestions)
        ? emotionPayload.suggestions
        : []
    })

    adviceCache.set(cacheKey, {
      summary: aiResult.summary,
      suggestions: aiResult.suggestions,
      createdAt: now
    })

    return {
      ...emotionPayload,
      summary: aiResult.summary || emotionPayload.summary,
      suggestions: aiResult.suggestions.length
        ? aiResult.suggestions
        : emotionPayload.suggestions,
      adviceSource: aiResult.suggestions.length ? 'deepseek' : 'fallback'
    }
  } catch (error) {
    console.warn('[deepseek] emotion advice generation failed:', toErrorMessage(error))
    return withAdviceSource(emotionPayload, 'fallback')
  }
}

async function generateEmotionAdvice({
  currentMood,
  score,
  history = [],
  fallbackSummary = '',
  fallbackSuggestions = []
}) {
  const completion = await deepseekClient.chat.completions.create({
    model: env.deepseek.model,
    messages: [
      {
        role: 'system',
        content:
          'You are a pet emotion care assistant. Return only valid JSON. Do not return markdown or explanations.'
      },
      {
        role: 'user',
        content: [
          'Generate a Chinese summary and 4 Chinese care suggestions based on the pet emotion data below.',
          '',
          `currentMood: ${currentMood}`,
          `score: ${score ?? ''}`,
          `history: ${JSON.stringify(history)}`,
          fallbackSummary ? `fallbackSummary: ${fallbackSummary}` : '',
          fallbackSuggestions.length
            ? `fallbackSuggestions: ${JSON.stringify(fallbackSuggestions)}`
            : '',
          '',
          'Return exactly this JSON shape:',
          '{',
          '  "summary": "一句中文总结",',
          '  "suggestions": [',
          '    { "label": "优先动作", "value": "...", "icon": "heart" },',
          '    { "label": "互动方式", "value": "...", "icon": "gift" },',
          '    { "label": "环境调整", "value": "...", "icon": "leaf" },',
          '    { "label": "观察重点", "value": "...", "icon": "spark" }',
          '  ]',
          '}'
        ]
          .filter(Boolean)
          .join('\n')
      }
    ],
    stream: false,
    response_format: {
      type: 'json_object'
    }
  })

  const content = completion?.choices?.[0]?.message?.content || '{}'
  const parsed = JSON.parse(content)

  return {
    summary: typeof parsed?.summary === 'string' ? parsed.summary.trim() : '',
    suggestions: normalizeSuggestions(parsed?.suggestions)
  }
}

function normalizeSuggestions(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item, index) => {
      const fallbackLabels = ['优先动作', '互动方式', '环境调整', '观察重点']
      const fallbackIcons = ['heart', 'gift', 'leaf', 'spark']

      return {
        label:
          typeof item?.label === 'string' && item.label.trim()
            ? item.label.trim()
            : fallbackLabels[index] || `建议${index + 1}`,
        value:
          typeof item?.value === 'string' && item.value.trim()
            ? item.value.trim()
            : '',
        icon: normalizeIcon(item?.icon, fallbackIcons[index] || 'heart')
      }
    })
    .filter((item) => item.value)
    .slice(0, 4)
}

function normalizeIcon(value, fallback) {
  return ['heart', 'gift', 'leaf', 'spark'].includes(value) ? value : fallback
}

function normalizeNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function safeTrim(value) {
  return value == null ? '' : String(value).trim()
}

function withAdviceSource(payload, adviceSource) {
  return {
    ...payload,
    adviceSource
  }
}

function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error || '')
}
