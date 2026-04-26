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
    key: 'pet-house-environment',
    title: 'PetHouse Environment',
    metrics: [
      { key: 'PetHouse:Temp', label: 'PetHouse Temp', unit: '°C' },
      { key: 'PetHouse:Humi', label: 'PetHouse Humidity', unit: '%' },
      { key: 'PetHouse:MQ135', label: 'PetHouse Air Quality', unit: '' },
      { key: 'PetHouse:CO2', label: 'PetHouse CO2', unit: 'ppm' }
    ]
  },
  {
    key: 'pet-house-extra',
    title: 'PetHouse Extra',
    metrics: [
      { key: 'PetHouse:CH2O', label: 'PetHouse CH2O', unit: '' },
      { key: 'PetHouse:VOC', label: 'PetHouse VOC', unit: '' },
      { key: 'PetHouse:Weight', label: 'PetHouse Weight', unit: 'kg' },
      { key: 'PetHouse:Mood', label: 'PetHouse Mood', unit: '' }
    ]
  },
  {
    key: 'collar-temperature',
    title: 'Pet Temperature',
    metrics: [
      { key: 'Collar:temp', label: 'Pet Temp', unit: '°C' }
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
  addScalarMetric(result, items, 'PetHouse:Temp', 'PetHouse:Temp')
  addScalarMetric(result, items, 'PetHouse:Humi', 'PetHouse:Humi')
  addScalarMetric(result, items, 'PetHouse:MQ135', 'PetHouse:MQ135')
  addScalarMetric(result, items, 'PetHouse:CO2', 'PetHouse:CO2')
  addScalarMetric(result, items, 'PetHouse:CH2O', 'PetHouse:CH2O')
  addScalarMetric(result, items, 'PetHouse:VOC', 'PetHouse:VOC')
  addScalarMetric(result, items, 'PetHouse:Weight', 'PetHouse:Weight')
  addScalarMetric(result, items, 'PetHouse:Mood', 'PetHouse:Mood')
  addScalarMetric(result, items, 'Collar:temp', 'Collar:temp')

  addNestedMetric(result, items, 'Collar:BNO085', 'X', 'Collar:BNO085.X')
  addNestedMetric(result, items, 'Collar:BNO085', 'Y', 'Collar:BNO085.Y')
  addNestedMetric(result, items, 'Collar:BNO085', 'Z', 'Collar:BNO085.Z')

  addNestedMetric(result, items, 'Collar:GPS', 'Longitude', 'Collar:GPS.Longitude')
  addNestedMetric(result, items, 'Collar:GPS', 'Latitude', 'Collar:GPS.Latitude')

  addNestedMetric(result, items, 'Collar:MAX30102', 'HeartRate', 'Collar:MAX30102.HeartRate', {
    validateValue: isPositiveMetricValue
  })
  addNestedMetric(result, items, 'Collar:MAX30102', 'SPO2', 'Collar:MAX30102.SPO2', {
    validateValue: isPositiveMetricValue
  })

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

function addNestedMetric(result, items, itemKey, fieldName, metricKey, options = {}) {
  const item = items[itemKey]
  if (!hasItemValue(item) || typeof item.value !== 'object') {
    return
  }

  if (!Object.prototype.hasOwnProperty.call(item.value, fieldName)) {
    return
  }

  const value = item.value[fieldName]
  if (options.validateValue && !options.validateValue(value)) {
    return
  }

  result[metricKey] = {
    itemKey,
    time: item.time,
    value
  }
}

function hasItemValue(item) {
  return Boolean(item) && item.value !== undefined && item.value !== null
}

function isPositiveMetricValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0
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
