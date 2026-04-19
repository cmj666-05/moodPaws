import crypto from 'node:crypto'
import os from 'node:os'

export function createServiceId({ configuredId, port, dataMode }) {
  if (configuredId) {
    return configuredId
  }

  const host = os.hostname() || 'unknown-host'
  const raw = `${host}:${port}:${dataMode}`
  const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 10)
  return `moodpaws-${hash}`
}
