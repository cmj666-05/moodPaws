export function healthHandler({ mqttState, dbPath }) {
  return async function handleHealth(_request, response) {
    response.json({
      ok: true,
      service: 'moodpaws-server',
      mqtt: mqttState,
      db: {
        ok: true,
        path: dbPath
      },
      now: Date.now()
    })
  }
}
