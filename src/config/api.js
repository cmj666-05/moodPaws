export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
  pollInterval: Number(import.meta.env.VITE_API_POLL_INTERVAL || 5000)
}

export function buildApiUrl(path) {
  return `${apiConfig.baseUrl}${path}`
}
