import { registerPlugin } from '@capacitor/core'

function createEmptyDiscoveryResult(options = {}) {
  return {
    discoveredAt: Date.now(),
    reason: 'web_unavailable',
    serviceNamePrefix: options.serviceNamePrefix || '',
    serviceType: options.serviceType || '_http._tcp.',
    services: []
  }
}

export const LanDiscovery = registerPlugin('LanDiscovery', {
  web: async () => ({
    async discoverService(options = {}) {
      return createEmptyDiscoveryResult(options)
    }
  })
})
