const EMOTION_LABELS = Object.freeze({
  1: '生气',
  2: '焦虑',
  3: '开心',
  4: '孤独',
  5: '难过'
})

const SECTION_ORDER = Object.freeze(['宠物状态', '生命体征', '位置与运动'])

export const metricDefinitions = Object.freeze([
  {
    deviceName: 'DogHouse',
    identifier: 'EmotionState',
    metricKey: 'EmotionState',
    label: '情绪状态',
    section: '宠物状态',
    unit: '',
    valueMap: EMOTION_LABELS
  },
  {
    deviceName: 'Collar',
    identifier: 'Collar:temp',
    metricKey: 'Collar:temp',
    label: '项圈温度',
    section: '宠物状态',
    unit: '°C'
  },
  {
    deviceName: 'Collar',
    identifier: 'Collar:humidity',
    metricKey: 'Collar:humidity',
    label: '环境湿度',
    section: '宠物状态',
    unit: '%'
  },
  {
    deviceName: 'Collar',
    identifier: 'Collar:airQuality',
    metricKey: 'Collar:airQuality',
    label: '空气质量',
    section: '宠物状态',
    unit: ''
  },
  {
    deviceName: 'Collar',
    identifier: 'Collar:CO2',
    metricKey: 'Collar:CO2',
    label: 'CO2 浓度',
    section: '宠物状态',
    unit: 'ppm'
  },
  {
    deviceName: 'Collar',
    identifier: 'Collar:Battery',
    metricKey: 'Collar:Battery',
    label: '电量',
    section: '宠物状态',
    unit: '%'
  },
  {
    deviceName: 'Collar',
    identifier: 'Collar:Weight',
    metricKey: 'Collar:Weight',
    label: '体重',
    section: '生命体征',
    unit: 'kg'
  },
  {
    deviceName: 'Collar',
    identifier: 'Collar:MAX30102',
    section: '生命体征',
    children: [
      {
        metricKey: 'Collar:MAX30102.HeartRate',
        label: '心率',
        unit: 'bpm',
        path: ['HeartRate', 'heartRate', 'HR']
      },
      {
        metricKey: 'Collar:MAX30102.SPO2',
        label: '血氧',
        unit: '%',
        path: ['SPO2', 'SpO2', 'spo2']
      }
    ]
  },
  {
    deviceName: 'Collar',
    identifier: 'Collar:GPS',
    section: '位置与运动',
    children: [
      {
        metricKey: 'Collar:GPS.Longitude',
        label: '经度',
        unit: '',
        path: ['Longitude', 'longitude', 'lng']
      },
      {
        metricKey: 'Collar:GPS.Latitude',
        label: '纬度',
        unit: '',
        path: ['Latitude', 'latitude', 'lat']
      },
      {
        metricKey: 'Collar:GPS.Accuracy',
        label: '定位精度',
        unit: 'm',
        path: ['Accuracy', 'accuracy']
      }
    ]
  },
  {
    deviceName: 'Collar',
    identifier: 'Collar:BNO085',
    section: '位置与运动',
    children: [
      { metricKey: 'Collar:BNO085.X', label: '运动 X', unit: 'g', path: ['X', 'x'] },
      { metricKey: 'Collar:BNO085.Y', label: '运动 Y', unit: 'g', path: ['Y', 'y'] },
      { metricKey: 'Collar:BNO085.Z', label: '运动 Z', unit: 'g', path: ['Z', 'z'] }
    ]
  }
])

export function getHistoryPropertyDefinitions(metricKeys = []) {
  const metricKeySet = new Set(metricKeys.filter(Boolean))

  if (!metricKeySet.size) {
    return metricDefinitions
  }

  return metricDefinitions.filter((definition) => {
    if (definition.metricKey && metricKeySet.has(definition.metricKey)) {
      return true
    }

    return definition.children?.some((child) => metricKeySet.has(child.metricKey))
  })
}

export function flattenPropertyRecord(record) {
  const definition = findPropertyDefinition(record.deviceName, record.identifier)
  if (!definition) {
    return []
  }

  const parsedValue = unwrapAliyunValue(parseAliyunValue(record.value))
  const timestamp = normalizeTimestamp(record.time || record.ts || record.gmtCreate)
  const rawValue = toRawJson(record.value)

  if (definition.children?.length) {
    if (!parsedValue || typeof parsedValue !== 'object') {
      return []
    }

    return definition.children
      .map((child) => createMetricPoint({
        productKey: record.productKey,
        deviceName: record.deviceName,
        identifier: record.identifier,
        metricKey: child.metricKey,
        label: child.label,
        section: definition.section,
        unit: child.unit,
        value: readObjectValue(parsedValue, child.path),
        time: timestamp,
        rawValue
      }))
      .filter(Boolean)
  }

  return [
    createMetricPoint({
      productKey: record.productKey,
      deviceName: record.deviceName,
      identifier: record.identifier,
      metricKey: definition.metricKey,
      label: definition.label,
      section: definition.section,
      unit: definition.unit,
      value: parsedValue,
      valueMap: definition.valueMap,
      time: timestamp,
      rawValue
    })
  ].filter(Boolean)
}

export function flattenTelemetryPayload(payload, options = {}) {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const productKey = payload.productKey || options.productKey || ''
  const fallbackDeviceName = normalizeDeviceName(payload.deviceName || options.deviceName || '')
  const sourceItems = payload.items || payload.params || {}

  if (!sourceItems || typeof sourceItems !== 'object') {
    return []
  }

  return Object.entries(sourceItems).flatMap(([identifier, item]) => {
    const deviceName = fallbackDeviceName || inferDeviceNameFromIdentifier(identifier)
    const value = item && typeof item === 'object' && hasOwn(item, 'value')
      ? item.value
      : item
    const time = item && typeof item === 'object'
      ? item.time || item.gmtCreate || payload.gmtCreate
      : payload.gmtCreate

    return flattenPropertyRecord({
      productKey,
      deviceName,
      identifier,
      value,
      time,
      gmtCreate: payload.gmtCreate
    })
  })
}

export function createMetricSections(points = []) {
  const sectionMap = new Map()

  for (const point of points) {
    const sectionName = point.section || findMetricDefinition(point.metric_key)?.section || '设备数据'
    const metricDefinition = findMetricDefinition(point.metric_key)
    const metric = {
      key: point.metric_key,
      label: point.label || metricDefinition?.label || point.metric_key,
      value: getDisplayValue(point),
      unit: point.unit || metricDefinition?.unit || '',
      time: Number(point.ts) || null
    }

    if (!sectionMap.has(sectionName)) {
      sectionMap.set(sectionName, {
        title: sectionName,
        metrics: []
      })
    }

    sectionMap.get(sectionName).metrics.push(metric)
  }

  return Array.from(sectionMap.values()).sort((first, second) => {
    return getSectionOrder(first.title) - getSectionOrder(second.title)
  })
}

export function getEmotionLabel(value) {
  const key = String(Math.trunc(Number(value)))
  return EMOTION_LABELS[key] || ''
}

export function getDisplayValue(point) {
  if (point.value_text !== undefined && point.value_text !== null && point.value_text !== '') {
    return point.value_text
  }

  if (point.value_num !== undefined && point.value_num !== null && Number.isFinite(Number(point.value_num))) {
    return Number(point.value_num)
  }

  return '--'
}

export function getMetricNumericValue(point) {
  const numericValue = Number(point?.value_num ?? point?.value_text)
  return Number.isFinite(numericValue) ? numericValue : null
}

function findPropertyDefinition(deviceName, identifier) {
  return metricDefinitions.find((definition) => {
    const normalizedDeviceName = normalizeDeviceName(deviceName)
    const deviceMatches = !definition.deviceName || !normalizedDeviceName || definition.deviceName === normalizedDeviceName
    return deviceMatches && definition.identifier === identifier
  })
}

function inferDeviceNameFromIdentifier(identifier) {
  const definition = metricDefinitions.find((item) => item.identifier === identifier)
  if (definition?.deviceName) {
    return definition.deviceName
  }

  const normalizedIdentifier = String(identifier || '')
  if (normalizedIdentifier.startsWith('Collar:')) {
    return 'Collar'
  }
  if (normalizedIdentifier === 'EmotionState') {
    return 'DogHouse'
  }

  return ''
}

function normalizeDeviceName(deviceName) {
  const normalized = String(deviceName || '').trim()
  return normalized === '--' ? '' : normalized
}

function findMetricDefinition(metricKey) {
  for (const definition of metricDefinitions) {
    if (definition.metricKey === metricKey) {
      return definition
    }

    const child = definition.children?.find((item) => item.metricKey === metricKey)
    if (child) {
      return {
        ...child,
        section: definition.section
      }
    }
  }

  return null
}

function createMetricPoint(options) {
  const normalizedTime = Number(options.time) || Date.now()
  const value = normalizeMetricValue(options.value, options.valueMap)

  if (!value.hasValue) {
    return null
  }

  return {
    product_key: options.productKey,
    device_name: options.deviceName,
    identifier: options.identifier,
    metric_key: options.metricKey,
    label: options.label || options.metricKey,
    section: options.section || '设备数据',
    unit: options.unit || '',
    value_num: value.valueNum,
    value_text: value.valueText,
    ts: normalizedTime,
    raw_value: options.rawValue,
    received_at: Date.now()
  }
}

function normalizeMetricValue(value, valueMap) {
  if (value === undefined || value === null || value === '') {
    return { hasValue: false, valueNum: null, valueText: '' }
  }

  const numericValue = Number(value)
  const isNumeric = Number.isFinite(numericValue) && value !== true && value !== false

  if (valueMap && isNumeric) {
    return {
      hasValue: true,
      valueNum: numericValue,
      valueText: valueMap[String(Math.trunc(numericValue))] || String(value)
    }
  }

  if (isNumeric) {
    return {
      hasValue: true,
      valueNum: numericValue,
      valueText: ''
    }
  }

  return {
    hasValue: true,
    valueNum: null,
    valueText: String(value)
  }
}

function parseAliyunValue(value) {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

function unwrapAliyunValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && hasOwn(value, 'data')) {
    return value.data
  }

  return value
}

function readObjectValue(source, pathCandidates = []) {
  for (const path of pathCandidates) {
    if (source && hasOwn(source, path)) {
      return source[path]
    }
  }

  return undefined
}

function normalizeTimestamp(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Date.now()
  }

  return parsed < 100000000000 ? parsed * 1000 : parsed
}

function toRawJson(value) {
  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function getSectionOrder(sectionName) {
  const index = SECTION_ORDER.indexOf(sectionName)
  return index === -1 ? SECTION_ORDER.length : index
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key)
}
