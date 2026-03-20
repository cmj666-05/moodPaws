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

export function formatMqttTime(value) {
  if (!value) return '--'

  const asNumber = Number(value)
  if (!Number.isFinite(asNumber)) return '--'

  return new Date(asNumber).toLocaleString('zh-CN', {
    hour12: false
  })
}

export function getEmptyDashboardData() {
  return normalizeDashboardPayload(null, null)
}

export function parseDashboardPayload(payloadText, previousData = null) {
  const payload = JSON.parse(payloadText)
  return normalizeDashboardPayload(payload, previousData)
}

export function normalizeDashboardPayload(payload, previousData = null) {
  const items = payload?.items ?? {}
  const normalizedMetrics = extractMetricsFromItems(items)
  const previousMetricMap = createMetricMap(previousData)
  const previousSource = previousData?.source ?? {}
  const nextSections = metricSections.map((section) => ({
    key: section.key,
    title: section.title,
    metrics: section.metrics.map((metric) => {
      const currentMetric = normalizedMetrics[metric.key]
      const previousMetric = previousMetricMap[metric.key]
      const hasCurrentValue = currentMetric?.value !== undefined && currentMetric?.value !== null

      return {
        key: metric.key,
        label: metric.label,
        unit: metric.unit,
        value: hasCurrentValue ? currentMetric.value : previousMetric?.value ?? '--',
        time: hasCurrentValue
          ? formatMqttTime(currentMetric?.time)
          : previousMetric?.time ?? '--'
      }
    })
  }))

  return {
    raw: payload ?? previousData?.raw ?? null,
    source: {
      deviceName: payload?.deviceName ?? previousSource.deviceName ?? '--',
      requestId: payload?.requestId ?? previousSource.requestId ?? '--',
      createdAt: payload?.gmtCreate
        ? formatMqttTime(payload.gmtCreate)
        : previousSource.createdAt ?? '--'
    },
    sections: nextSections
  }
}

function createMetricMap(previousData) {
  if (!previousData?.sections) {
    return {}
  }

  return previousData.sections
    .flatMap((section) => section.metrics)
    .reduce((result, metric) => {
      result[metric.key] = metric
      return result
    }, {})
}

function extractMetricsFromItems(items) {
  const result = {}

  const flatKeys = [
    'PetHouse:Temp',
    'PetHouse:Humi',
    'PetHouse:CO2',
    'PetHouse:CH2O',
    'PetHouse:VOC',
    'PetHouse:MQ135',
    'PetHouse:Weight'
  ]

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
