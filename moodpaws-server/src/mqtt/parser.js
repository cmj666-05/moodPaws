const metricSections = [
  {
    key: 'pet-house',
    title: 'PetHouse',
    metrics: [
      { key: 'PetHouse:Temp', label: 'Temperature', unit: 'C' },
      { key: 'PetHouse:Humi', label: 'Humidity', unit: '%' },
      { key: 'PetHouse:CO2', label: 'CO2', unit: 'ppm' },
      { key: 'PetHouse:CH2O', label: 'CH2O', unit: 'ppb' },
      { key: 'PetHouse:VOC', label: 'VOC', unit: 'lvl' },
      { key: 'PetHouse:MQ135', label: 'MQ135', unit: 'lvl' },
      { key: 'PetHouse:Weight', label: 'Weight', unit: 'kg' }
    ]
  },
  {
    key: 'collar-motion',
    title: 'Collar Motion',
    metrics: [
      { key: 'X', label: 'Axis X', unit: '' },
      { key: 'Y', label: 'Axis Y', unit: '' },
      { key: 'Z', label: 'Axis Z', unit: '' }
    ]
  },
  {
    key: 'collar-health',
    title: 'Collar Health',
    metrics: [
      { key: 'HeartRate', label: 'Heart Rate', unit: 'bpm' },
      { key: 'SPO2', label: 'SpO2', unit: '%' }
    ]
  },
  {
    key: 'collar-location',
    title: 'Collar Location',
    metrics: [
      { key: 'Longitude', label: 'Longitude', unit: '' },
      { key: 'Latitude', label: 'Latitude', unit: '' }
    ]
  }
]

const flatKeys = [
  'PetHouse:Temp',
  'PetHouse:Humi',
  'PetHouse:CO2',
  'PetHouse:CH2O',
  'PetHouse:VOC',
  'PetHouse:MQ135',
  'PetHouse:Weight'
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
      createdAt: Number(payload?.gmtCreate) || Number(payload?.id) || null
    },
    metricPoints: Object.entries(metrics).map(([metricKey, metric]) => ({
      metricKey,
      valueNum: toNumeric(metric.value),
      valueText: toNumeric(metric.value) === null ? stringifyValue(metric.value) : null,
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

  flatKeys.forEach((key) => {
    if (items[key]) {
      result[key] = items[key]
    }
  })

  const xyz = items['Collar:XYZ']
  if (xyz?.value) {
    result.X = { time: xyz.time, value: xyz.value.X }
    result.Y = { time: xyz.time, value: xyz.value.Y }
    result.Z = { time: xyz.time, value: xyz.value.Z }
  }

  const gps = items['Collar:GPS']
  if (gps?.value) {
    result.Longitude = { time: gps.time, value: gps.value.Longitude }
    result.Latitude = { time: gps.time, value: gps.value.Latitude }
  }

  const health = items['Collar:XKXY']
  if (health?.value) {
    result.HeartRate = { time: health.time, value: health.value.HeartRate }
    result.SPO2 = { time: health.time, value: health.value.SPO2 }
  }

  return result
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
