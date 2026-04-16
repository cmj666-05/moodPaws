const MOOD_META = {
  1: { key: 'angry', label: '生气' },
  2: { key: 'anxious', label: '焦虑' },
  3: { key: 'happy', label: '开心' },
  4: { key: 'lonely', label: '孤独' },
  5: { key: 'sad', label: '难过' }
}

export function normalizeMoodCode(value) {
  const code = Number(value)
  return Number.isInteger(code) && MOOD_META[code] ? code : null
}

export function getMoodMeta(value) {
  const code = normalizeMoodCode(value)
  return code ? { code, ...MOOD_META[code] } : null
}

export function getMoodLabel(value) {
  return getMoodMeta(value)?.label ?? null
}
