import { Bonjour } from 'bonjour-service'

function createPublishedName(baseName, serviceId) {
  const suffix = serviceId.replace(/^moodpaws-/, '').slice(-6)
  return suffix ? `${baseName}-${suffix}` : baseName
}

export function createServiceDiscovery({ env, port, serviceId, discoveryState }) {
  let bonjour = null
  let service = null

  async function start() {
    if (!discoveryState.enabled) {
      discoveryState.lastEvent = 'disabled'
      return false
    }

    if (service) {
      return true
    }

    discoveryState.lastEvent = 'starting'
    discoveryState.lastError = ''

    try {
      const publishedName = createPublishedName(env.service.name, serviceId)
      discoveryState.serviceName = publishedName

      bonjour = new Bonjour()
      service = bonjour.publish({
        name: publishedName,
        type: 'http',
        port,
        txt: {
          id: serviceId,
          path: env.service.healthPath,
          mode: env.dataMode,
          video: env.video.enabled ? '1' : '0',
          videoUrl: env.video.url || '',
          videoOrigin: env.video.origin || '',
          videoHost: env.video.host || '',
          videoPort: String(env.video.port || ''),
          videoPath: env.video.path || ''
        }
      })

      service.on('error', (error) => {
        discoveryState.published = false
        discoveryState.lastError = error instanceof Error ? error.message : String(error)
        discoveryState.lastEvent = 'publish_error'
      })

      service.start()
      discoveryState.published = true
      discoveryState.publishedAt = Date.now()
      discoveryState.stoppedAt = null
      discoveryState.lastEvent = 'published'
      return true
    } catch (error) {
      discoveryState.published = false
      discoveryState.lastError = error instanceof Error ? error.message : String(error)
      discoveryState.lastEvent = 'publish_error'
      return false
    }
  }

  async function stop() {
    if (!bonjour) {
      discoveryState.published = false
      discoveryState.stoppedAt = Date.now()
      if (discoveryState.lastEvent !== 'publish_error' && discoveryState.lastEvent !== 'disabled') {
        discoveryState.lastEvent = 'stopped'
      }
      return
    }

    discoveryState.lastEvent = 'stopping'

    try {
      if (service) {
        await new Promise((resolve) => {
          service.stop(() => resolve())
        })
      }

      bonjour.destroy()
      discoveryState.published = false
      discoveryState.stoppedAt = Date.now()
      discoveryState.lastEvent = 'stopped'
      discoveryState.lastError = ''
    } catch (error) {
      discoveryState.lastError = error instanceof Error ? error.message : String(error)
      discoveryState.lastEvent = 'stop_error'
    } finally {
      service = null
      bonjour = null
    }
  }

  function getState() {
    return {
      ...discoveryState
    }
  }

  return {
    start,
    stop,
    getState
  }
}
