const defaultBaseUrl = 'http://10.255.115.243:3001/api'

export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || defaultBaseUrl,
  pollInterval: Number(import.meta.env.VITE_API_POLL_INTERVAL || 5000)
}

export function buildApiUrl(path) {
  return `${apiConfig.baseUrl}${path}`
}
