function createCollarPayload(ts, index) {
  const longitude = 106.60342 + index * 0.00028
  const latitude = 29.38218 + index * 0.00019
  const heartRate = 82 + (index % 6) * 2
  const spo2 = 96 + (index % 3)
  const x = index % 2 === 0 ? 0.14 + index * 0.01 : 0.62 + index * 0.015
  const y = index % 2 === 0 ? 0.22 + index * 0.008 : 0.91 + index * 0.012
  const z = index % 2 === 0 ? 0.93 + index * 0.006 : 1.68 + index * 0.01

  return {
    id: ts,
    requestId: `collar-${String(index + 1).padStart(3, '0')}`,
    gmtCreate: ts,
    deviceName: 'Collar',
    items: {
      'Collar:GPS': { time: ts, value: { Longitude: Number(longitude.toFixed(6)), Latitude: Number(latitude.toFixed(6)) } },
      'Collar:XKXY': { time: ts, value: { HeartRate: heartRate, SPO2: spo2 } },
      'Collar:XYZ': { time: ts, value: { X: Number(x.toFixed(3)), Y: Number(y.toFixed(3)), Z: Number(z.toFixed(3)) } }
    }
  }
}

function createHousePayload(ts, index) {
  return {
    id: ts,
    requestId: `doghouse-${String(index + 1).padStart(3, '0')}`,
    gmtCreate: ts,
    deviceName: 'DogHouse',
    items: {
      'PetHouse:Temp': { time: ts, value: 25 + index * 0.2 },
      'PetHouse:Humi': { time: ts, value: 58 - index },
      'PetHouse:CO2': { time: ts, value: 480 + index * 12 },
      'PetHouse:CH2O': { time: ts, value: 6 + index },
      'PetHouse:VOC': { time: ts, value: 10 + index },
      'PetHouse:MQ135': { time: ts, value: 180 + index * 6 },
      'PetHouse:Weight': { time: ts, value: Number((12.4 + index * 0.08).toFixed(2)) },
      'PetHouse:Mood': { time: ts, value: 3 + (index % 2) }
    }
  }
}

export function buildDemoState() {
  const now = Date.now()
  const topic = '/k1wxaEnEO8L/petInfo/user/get'
  const startTs = now - 9 * 60 * 1000
  const mqttMessages = []
  const metricPoints = []
  let messageId = 1
  let metricPointId = 1

  for (let index = 0; index < 10; index += 1) {
    const ts = startTs + index * 60 * 1000
    const payload = createCollarPayload(ts, index)
    mqttMessages.push({
      id: messageId,
      topic,
      device_name: 'Collar',
      request_id: payload.requestId,
      gmt_create: ts,
      payload_json: JSON.stringify(payload),
      received_at: ts
    })

    for (const [metricKey, valueNum] of [
      ['HeartRate', payload.items['Collar:XKXY'].value.HeartRate],
      ['SPO2', payload.items['Collar:XKXY'].value.SPO2],
      ['Longitude', payload.items['Collar:GPS'].value.Longitude],
      ['Latitude', payload.items['Collar:GPS'].value.Latitude],
      ['X', payload.items['Collar:XYZ'].value.X],
      ['Y', payload.items['Collar:XYZ'].value.Y],
      ['Z', payload.items['Collar:XYZ'].value.Z]
    ]) {
      metricPoints.push({
        id: metricPointId,
        message_id: messageId,
        metric_key: metricKey,
        value_num: valueNum,
        value_text: null,
        ts
      })
      metricPointId += 1
    }

    messageId += 1
  }

  for (let index = 0; index < 6; index += 1) {
    const ts = startTs + index * 90 * 1000 + 30 * 1000
    const payload = createHousePayload(ts, index)
    mqttMessages.push({
      id: messageId,
      topic,
      device_name: 'DogHouse',
      request_id: payload.requestId,
      gmt_create: ts,
      payload_json: JSON.stringify(payload),
      received_at: ts
    })

    for (const [metricKey, valueNum, valueText] of [
      ['PetHouse:Temp', payload.items['PetHouse:Temp'].value, null],
      ['PetHouse:Humi', payload.items['PetHouse:Humi'].value, null],
      ['PetHouse:CO2', payload.items['PetHouse:CO2'].value, null],
      ['PetHouse:CH2O', payload.items['PetHouse:CH2O'].value, null],
      ['PetHouse:VOC', payload.items['PetHouse:VOC'].value, null],
      ['PetHouse:MQ135', payload.items['PetHouse:MQ135'].value, null],
      ['PetHouse:Weight', payload.items['PetHouse:Weight'].value, null],
      ['PetHouse:Mood', payload.items['PetHouse:Mood'].value, String(payload.items['PetHouse:Mood'].value)]
    ]) {
      metricPoints.push({
        id: metricPointId,
        message_id: messageId,
        metric_key: metricKey,
        value_num: typeof valueNum === 'number' ? valueNum : null,
        value_text: valueText,
        ts
      })
      metricPointId += 1
    }

    messageId += 1
  }

  const emotionSnapshots = [
    {
      id: 1,
      source: 'mock',
      mood_label: '开心',
      score: 86,
      summary_json: JSON.stringify({
        voice: { frequency: [10, 12, 15, 18, 16, 13], tone: [9, 11, 14, 15, 14, 12] },
        fluctuation: { timeline: ['06:00', '10:00', '14:00', '18:00', '22:00', '24:00'], values: [58, 66, 74, 81, 77, 72] },
        history: [
          { label: '主情绪', value: '开心' },
          { label: '活跃度', value: '中高' },
          { label: '舒适度', value: '稳定' }
        ]
      }),
      created_at: now
    }
  ]

  return { mqttMessages, metricPoints, emotionSnapshots }
}

const state = buildDemoState()

export function getMemoryState() {
  return state
}
