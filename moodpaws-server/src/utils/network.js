import os from 'node:os'

const EXCLUDED_INTERFACE_PATTERNS = [
  /vmware/i,
  /virtualbox/i,
  /\bvbox\b/i,
  /hyper-v/i,
  /wsl/i,
  /docker/i,
  /podman/i,
  /radmin/i,
  /\bvpn\b/i,
  /mihomo/i,
  /tailscale/i,
  /zerotier/i,
  /loopback/i
]

function normalizeFamily(family) {
  if (family === 4 || family === 'IPv4') return 'IPv4'
  if (family === 6 || family === 'IPv6') return 'IPv6'
  return String(family)
}

function shouldExcludeInterface(name) {
  const normalized = String(name || '').trim()
  if (!normalized) {
    return false
  }

  return EXCLUDED_INTERFACE_PATTERNS.some((pattern) => pattern.test(normalized))
}

function isLinkLocalIpv4(address) {
  return String(address || '').startsWith('169.254.')
}

export function getAccessibleAddresses(port) {
  const networkMap = os.networkInterfaces()
  const seen = new Set()
  const addresses = [
    {
      family: 'IPv4',
      address: '127.0.0.1',
      url: `http://127.0.0.1:${port}`
    }
  ]

  for (const [interfaceName, items] of Object.entries(networkMap)) {
    if (shouldExcludeInterface(interfaceName)) {
      continue
    }

    for (const item of items ?? []) {
      const family = normalizeFamily(item.family)
      if (family !== 'IPv4' || item.internal || !item.address || isLinkLocalIpv4(item.address)) {
        continue
      }

      const key = `${family}:${item.address}`
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      addresses.push({
        family,
        interfaceName,
        address: item.address,
        url: `http://${item.address}:${port}`
      })
    }
  }

  return addresses
}
