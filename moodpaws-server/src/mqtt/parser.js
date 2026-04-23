import { getMoodLabel } from '../utils/emotion-mood.js'

const metricSections = [
  {
    key: 'dog-house',
    title: 'DogHouse',
    metrics: [
      { key: 'EmotionState', label: 'Emotion State', unit: '' }
    ]
  },
  {
    key: 'collar-temperature',
    title: 'Collar Temperature',
    metrics: [
      { key: 'Collar:temp', label: 'Collar Temp', unit: 'C' }
    ]
  },
  {
    key: 'collar-motion',
    title: 'Collar BNO085',
    metrics: [
      { key: 'Collar:BNO085.X', label: 'Axis X', unit: '' },
      { key: 'Collar:BNO085.Y', label: 'Axis Y', unit: '' },
      { key: 'Collar:BNO085.Z', label: 'Axis Z', unit: '' }
    ]
  },
  {
    key: 'collar-health',
    title: 'Collar MAX30102',
    metrics: [
      { key: 'Collar:MAX30102.HeartRate', label: 'Heart Rate', unit: 'bpm' },
      { key: 'Collar:MAX30102.SPO2', label: 'SpO2', unit: '%' }
    ]
  },
  {
    key: 'collar-gps',
    title: 'Collar GPS',
    metrics: [
      { key: 'Collar:GPS.Longitude', label: 'Longitude', unit: '' },
      { key: 'Collar:GPS.Latitude', label: 'Latitude', unit: '' }
    ]
  }
]

export function parsePayloadText(payloadText, topic = '') {
  const payload = JSON.parse(payloadText)
  return parsePayloadObject(payload, topic)
}

export function parsePayloadObject(payload, topic = '') {
  const items = payload?.items ?? {}
  const metrics = extractMetricsFromItems(items)

  return {
    raw: payload ?? null,
    source: {
      deviceName: inferDeviceName(payload, topic),
      requestId: payload?.requestId ?? payload?.id?.toString?.() ?? '--',
      createdAt: Number(payload?.gmtCreate) || Number(payload?.id) || null,
      deviceType: payload?.deviceType ?? '',
      iotId: payload?.iotId ?? '',
      productKey: payload?.productKey ?? ''
    },
    checkFailedData: payload?.checkFailedData ?? null,
    metricPoints: Object.entries(metrics).map(([metricKey, metric]) => ({
      metricKey,
      itemKey: metric.itemKey ?? metricKey,
      valueNum: toNumeric(metric.rawValue ?? metric.value),
      valueText: toNumeric(metric.rawValue ?? metric.value) === null ? stringifyValue(metric.value) : null,
      ts: Number(metric.time) || Number(payload?.gmtCreate) || Number(payload?.id) || Date.now()
    })),
    sections: metricSections.map((section) => ({
      key: section.key,
      title: section.title,
      metrics: section.metrics.map((metric) => {
        const current = metrics[metric.key]
        return {
          key: metric.key,
          label: metric.label,
          unit: metric.unit,
          value: current?.value ?? '--',
          time: Number(current?.time) || null
        }
      })
    }))
  }
}

function extractMetricsFromItems(items) {
  const result = {}

  addScalarMetric(result, items, 'EmotionState', 'EmotionState', {
    formatValue: (value) => getMoodLabel(value) ?? value
  })
  addScalarMetric(result, items, 'Collar:temp', 'Collar:temp')

  addNestedMetric(result, items, 'Collar:BNO085', 'X', 'Collar:BNO085.X')
  addNestedMetric(result, items, 'Collar:BNO085', 'Y', 'Collar:BNO085.Y')
  addNestedMetric(result, items, 'Collar:BNO085', 'Z', 'Collar:BNO085.Z')

  addNestedMetric(result, items, 'Collar:GPS', 'Longitude', 'Collar:GPS.Longitude')
  addNestedMetric(result, items, 'Collar:GPS', 'Latitude', 'Collar:GPS.Latitude')

  addNestedMetric(result, items, 'Collar:MAX30102', 'HeartRate', 'Collar:MAX30102.HeartRate')
  addNestedMetric(result, items, 'Collar:MAX30102', 'SPO2', 'Collar:MAX30102.SPO2')

  return result
}

function addScalarMetric(result, items, itemKey, metricKey, options = {}) {
  const item = items[itemKey]
  if (!hasItemValue(item)) {
    return
  }

  result[metricKey] = {
    itemKey,
    time: item.time,
    rawValue: item.value,
    value: options.formatValue ? options.formatValue(item.value) : item.value
  }
}

function addNestedMetric(result, items, itemKey, fieldName, metricKey) {
  const item = items[itemKey]
  if (!hasItemValue(item) || typeof item.value !== 'object') {
    return
  }

  if (!Object.prototype.hasOwnProperty.call(item.value, fieldName)) {
    return
  }

  result[metricKey] = {
    itemKey,
    time: item.time,
    value: item.value[fieldName]
  }
}

function hasItemValue(item) {
  return Boolean(item) && item.value !== undefined && item.value !== null
}

function inferDeviceName(payload, topic) {
  if (payload?.deviceName) {
    return payload.deviceName
  }

  const match = topic.match(/^\/[^/]+\/([^/]+)\/([^/]+)$/)
  return match?.[2] || '--'
}

function toNumeric(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stringifyValue(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}
