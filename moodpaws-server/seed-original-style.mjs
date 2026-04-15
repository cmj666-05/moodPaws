import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'

const envModule = await import(pathToFileURL('D:/desktop/moodPaws/moodpaws-server/src/config/env.js').href)
const { env } = envModule
const db = new DatabaseSync(env.dbPath)
db.exec('PRAGMA foreign_keys = ON;')

const run = (sql, params = []) => db.prepare(sql).run(...params)
const petTopic = '/k1wxaEnEO8L/petInfo/user/get'
const startTs = Date.now() - 59 * 60 * 1000

const collarSeries = [
  [29.38218,106.60342,82,96,0.10,0.18,0.95,0.02,-0.01,0.03,31.2,-12.5,7.1],
  [29.38234,106.60368,84,96,0.42,0.71,1.58,0.04,-0.03,0.02,33.4,-10.2,6.8],
  [29.38249,106.60395,86,97,0.16,0.23,0.92,0.01,-0.01,0.01,30.8,-11.6,6.5],
  [29.38263,106.60423,88,97,0.55,0.80,1.66,0.06,-0.04,0.03,35.1,-8.7,6.1],
  [29.38277,106.60452,91,97,0.12,0.19,0.90,0.01,-0.01,0.01,31.0,-10.8,5.9],
  [29.38288,106.60481,93,98,0.64,0.92,1.74,0.07,-0.05,0.04,36.7,-7.5,5.4],
  [29.38296,106.60513,95,98,0.14,0.22,0.94,0.01,-0.02,0.01,32.2,-9.9,5.1],
  [29.38301,106.60546,92,98,0.72,1.02,1.81,0.08,-0.05,0.04,37.9,-6.2,4.8],
  [29.38303,106.60578,90,97,0.18,0.28,0.96,0.02,-0.01,0.01,33.0,-8.6,4.5],
  [29.38300,106.60607,89,97,0.61,0.88,1.69,0.06,-0.04,0.03,35.6,-7.8,4.2],
  [29.38292,106.60634,88,97,0.11,0.20,0.93,0.01,-0.01,0.01,31.7,-9.4,4.0],
  [29.38280,106.60658,87,97,0.58,0.84,1.65,0.05,-0.04,0.03,34.9,-7.1,3.8],
  [29.38265,106.60679,86,96,0.13,0.21,0.91,0.01,-0.01,0.01,32.1,-8.8,3.5],
  [29.38247,106.60696,88,97,0.66,0.95,1.78,0.07,-0.05,0.04,36.4,-6.4,3.1],
  [29.38228,106.60708,91,97,0.17,0.27,0.95,0.02,-0.01,0.01,33.2,-7.9,2.9],
  [29.38208,106.60716,94,98,0.74,1.06,1.86,0.08,-0.06,0.04,38.3,-5.7,2.5],
  [29.38187,106.60718,96,98,0.15,0.24,0.93,0.01,-0.01,0.01,32.8,-7.4,2.2],
  [29.38166,106.60714,98,99,0.82,1.14,1.93,0.09,-0.06,0.05,39.6,-4.8,1.9],
  [29.38146,106.60705,95,98,0.19,0.30,0.97,0.02,-0.02,0.01,34.1,-6.3,1.6],
  [29.38128,106.60692,92,97,0.68,0.98,1.79,0.07,-0.05,0.04,36.2,-5.9,1.2],
  [29.38113,106.60675,89,97,0.14,0.22,0.92,0.01,-0.01,0.01,32.7,-7.1,0.9],
  [29.38101,106.60654,87,96,0.57,0.83,1.63,0.06,-0.04,0.03,34.5,-6.7,0.6],
  [29.38093,106.60630,85,96,0.12,0.18,0.90,0.01,-0.01,0.01,31.9,-8.0,0.2],
  [29.38090,106.60603,84,96,0.49,0.72,1.52,0.05,-0.03,0.03,33.8,-7.3,-0.1],
  [29.38093,106.60576,83,95,0.11,0.17,0.89,0.01,-0.01,0.01,31.1,-8.2,-0.4],
  [29.38101,106.60550,82,95,0.45,0.66,1.46,0.04,-0.03,0.02,33.1,-7.7,-0.8],
  [29.38113,106.60528,84,96,0.13,0.20,0.91,0.01,-0.01,0.01,31.6,-8.5,-1.1],
  [29.38129,106.60509,86,96,0.54,0.79,1.60,0.05,-0.04,0.03,34.2,-7.0,-1.4],
  [29.38147,106.60494,88,97,0.16,0.25,0.94,0.02,-0.01,0.01,32.4,-7.9,-1.8],
  [29.38167,106.60483,90,97,0.63,0.90,1.71,0.06,-0.05,0.04,35.7,-6.1,-2.0],
  [29.38188,106.60475,93,98,0.14,0.21,0.92,0.01,-0.01,0.01,31.8,-7.6,-2.3],
  [29.38207,106.60468,95,98,0.71,1.01,1.82,0.08,-0.05,0.04,37.6,-5.4,-2.6],
  [29.38222,106.60457,97,99,0.17,0.26,0.95,0.02,-0.02,0.01,33.6,-6.8,-2.9],
  [29.38231,106.60440,94,98,0.60,0.87,1.68,0.06,-0.04,0.03,35.1,-6.0,-3.1],
  [29.38234,106.60418,91,97,0.12,0.19,0.90,0.01,-0.01,0.01,31.5,-7.2,-3.4],
  [29.38233,106.60395,88,97,0.52,0.76,1.56,0.05,-0.03,0.03,33.9,-6.5,-3.7],
  [29.38229,106.60374,86,96,0.11,0.17,0.89,0.01,-0.01,0.01,30.9,-7.9,-4.0],
  [29.38223,106.60355,84,96,0.47,0.69,1.49,0.04,-0.03,0.02,32.7,-7.1,-4.3],
  [29.38218,106.60342,83,95,0.10,0.16,0.88,0.01,-0.01,0.01,30.6,-8.4,-4.6],
  [29.38218,106.60342,82,95,0.43,0.63,1.43,0.04,-0.03,0.02,32.0,-7.5,-4.9]
].map(([lat, lng, heart, spo2, x, y, z, gx, gy, gz, mx, my, mz]) => ({ lat, lng, heart, spo2, x, y, z, gx, gy, gz, mx, my, mz }))

const dogHouseSeries = [
  [26.4,61,512,6,4,182,12.6],[26.3,62,518,6,4,184,12.6],[26.5,60,525,7,4,186,12.7],[26.6,59,533,7,5,188,12.7],[26.8,58,540,7,5,190,12.8],[27.0,57,548,8,5,193,12.8],[27.1,56,556,8,6,196,12.9],[27.2,55,563,8,6,198,12.9],[27.3,54,570,9,6,201,13.0],[27.5,53,578,9,7,204,13.0],[27.6,52,585,9,7,207,13.1],[27.7,51,592,10,7,209,13.1],[27.8,50,600,10,8,212,13.2],[27.9,49,608,10,8,214,13.2],[28.0,48,615,11,8,217,13.3],[28.1,47,623,11,9,219,13.3],[28.2,46,631,11,9,222,13.4],[28.3,45,638,12,9,225,13.4],[28.4,44,646,12,10,228,13.5],[28.5,43,654,12,10,230,13.5]
].map(([temp, humi, co2, ch2o, voc, mq135, weight]) => ({ temp, humi, co2, ch2o, voc, mq135, weight }))

const emotionSummary = {
  voice: { frequency: [10,12,14,16,18,20,19,17,15,13], tone: [14,15,16,17,18,19,18,17,16,15] },
  fluctuation: { timeline: ['06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00','24:00'], values: [58,62,68,72,76,81,84,80,74,70] },
  history: [
    { label: '晨间情绪', value: '平静偏开心' },
    { label: '午后活力', value: '明显提升' },
    { label: '晚间状态', value: '活跃后放松' }
  ]
}

db.exec('BEGIN')
try {
  run('DELETE FROM emotion_snapshots')
  run('DELETE FROM mqtt_messages')
  run("DELETE FROM sqlite_sequence WHERE name IN ('mqtt_messages', 'metric_points', 'emotion_snapshots')")

  for (let i = 0; i < collarSeries.length; i += 1) {
    const item = collarSeries[i]
    const ts = startTs + i * 60 * 1000
    const payload = {
      id: ts,
      requestId: `collar-${String(i + 1).padStart(3, '0')}`,
      gmtCreate: ts,
      deviceName: 'Collar',
      items: {
        'Collar:GPS': { time: ts, value: { Longitude: item.lng, Latitude: item.lat } },
        'Collar:XKXY': { time: ts, value: { HeartRate: item.heart, SPO2: item.spo2 } },
        'Collar:XYZ': { time: ts, value: { X: item.x, Y: item.y, Z: item.z } },
        'Collar:GYRO': { time: ts, value: { X: item.gx, Y: item.gy, Z: item.gz } },
        'Collar:MAG': { time: ts, value: { X: item.mx, Y: item.my, Z: item.mz } }
      }
    }

    const messageResult = run(
      'INSERT INTO mqtt_messages (topic, device_name, request_id, gmt_create, payload_json, received_at) VALUES (?, ?, ?, ?, ?, ?)',
      [petTopic, 'Collar', payload.requestId, ts, JSON.stringify(payload), ts]
    )
    const messageId = Number(messageResult.lastInsertRowid)

    for (const [metricKey, valueNum] of [
      ['HeartRate', item.heart],
      ['SPO2', item.spo2],
      ['Longitude', item.lng],
      ['Latitude', item.lat],
      ['X', item.x],
      ['Y', item.y],
      ['Z', item.z]
    ]) {
      run('INSERT INTO metric_points (message_id, metric_key, value_num, value_text, ts) VALUES (?, ?, ?, ?, ?)', [messageId, metricKey, valueNum, null, ts])
    }
  }

  for (let i = 0; i < dogHouseSeries.length; i += 1) {
    const item = dogHouseSeries[i]
    const ts = startTs + i * 3 * 60 * 1000 + 30 * 1000
    const payload = {
      id: ts,
      requestId: `doghouse-${String(i + 1).padStart(3, '0')}`,
      gmtCreate: ts,
      deviceName: 'DogHouse',
      items: {
        'PetHouse:Temp': { time: ts, value: item.temp },
        'PetHouse:Humi': { time: ts, value: item.humi },
        'PetHouse:CO2': { time: ts, value: item.co2 },
        'PetHouse:CH2O': { time: ts, value: item.ch2o },
        'PetHouse:VOC': { time: ts, value: item.voc },
        'PetHouse:MQ135': { time: ts, value: item.mq135 },
        'PetHouse:Weight': { time: ts, value: item.weight }
      }
    }

    const messageResult = run(
      'INSERT INTO mqtt_messages (topic, device_name, request_id, gmt_create, payload_json, received_at) VALUES (?, ?, ?, ?, ?, ?)',
      [petTopic, 'DogHouse', payload.requestId, ts, JSON.stringify(payload), ts]
    )
    const messageId = Number(messageResult.lastInsertRowid)

    for (const [metricKey, valueNum] of [
      ['PetHouse:Temp', item.temp],
      ['PetHouse:Humi', item.humi],
      ['PetHouse:CO2', item.co2],
      ['PetHouse:CH2O', item.ch2o],
      ['PetHouse:VOC', item.voc],
      ['PetHouse:MQ135', item.mq135],
      ['PetHouse:Weight', item.weight]
    ]) {
      run('INSERT INTO metric_points (message_id, metric_key, value_num, value_text, ts) VALUES (?, ?, ?, ?, ?)', [messageId, metricKey, valueNum, null, ts])
    }
  }

  run('INSERT INTO emotion_snapshots (source, mood_label, score, summary_json, created_at) VALUES (?, ?, ?, ?, ?)', ['mock', '开心', 86, JSON.stringify(emotionSummary), Date.now()])

  db.exec('COMMIT')
  console.log(JSON.stringify({
    dbPath: env.dbPath,
    mqttMessages: collarSeries.length + dogHouseSeries.length,
    metricPoints: collarSeries.length * 7 + dogHouseSeries.length * 7,
    latestTopic: petTopic
  }, null, 2))
} catch (error) {
  db.exec('ROLLBACK')
  throw error
} finally {
  db.close()
}
