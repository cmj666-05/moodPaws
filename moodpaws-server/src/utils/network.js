import os from 'node:os'

function normalizeFamily(family) {
  if (family === 4 || family === 'IPv4') return 'IPv4'
  if (family === 6 || family === 'IPv6') return 'IPv6'
  return String(family)
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

  for (const items of Object.values(networkMap)) {
    for (const item of items ?? []) {
      const family = normalizeFamily(item.family)
      if (family !== 'IPv4' || item.internal || !item.address) {
        continue
      }

      const key = `${family}:${item.address}`
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      addresses.push({
        family,
        address: item.address,
        url: `http://${item.address}:${port}`
      })
    }
  }

  return addresses
}
