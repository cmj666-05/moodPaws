import { reactive, readonly } from 'vue'
import { Capacitor } from '@capacitor/core'
import { LanDiscovery } from '../plugins/lan-discovery'

const DEFAULT_SERVICE_TYPE = '_http._tcp.'
const VIDEO_MANUAL_STORAGE_KEY = 'moodpaws.video.manualStreamUrl'

const VIDEO_STREAM_PORT = Number(import.meta.env.VITE_VIDEO_STREAM_PORT || 5000)
const VIDEO_STREAM_PATH = normalizeUrlPath(import.meta.env.VITE_VIDEO_STREAM_PATH || '/video_feed')
const explicitVideoStreamUrl = normalizeAbsoluteUrl(import.meta.env.VITE_VIDEO_STREAM_URL || '')
const VIDEO_SERVICE_NAME_PREFIX = safeTrim(import.meta.env.VITE_VIDEO_MDNS_SERVICE_NAME || 'flocakweb')
const VIDEO_SERVICE_TYPE = normalizeServiceType(
  import.meta.env.VITE_VIDEO_MDNS_SERVICE_TYPE || DEFAULT_SERVICE_TYPE
)
const VIDEO_DISCOVERY_TIMEOUT_MS = parsePositiveInt(
  import.meta.env.VITE_VIDEO_DISCOVERY_TIMEOUT,
  2500
)

const manualVideoStreamUrl = explicitVideoStreamUrl ? '' : loadManualVideoStreamUrl()
const initialVideoConfig = createStoredVideoConfig()

const apiState = reactive({
  video: { ...initialVideoConfig }
})

let resolveVideoUrlPromise = null

export const apiEndpointState = readonly(apiState)

export const apiConfig = {
  pollInterval: parsePositiveInt(import.meta.env.VITE_API_POLL_INTERVAL, 5000),
  videoServiceNamePrefix: VIDEO_SERVICE_NAME_PREFIX,
  videoServiceType: VIDEO_SERVICE_TYPE,
  videoDiscoveryTimeoutMs: VIDEO_DISCOVERY_TIMEOUT_MS
}

export function useApiEndpointState() {
  return apiEndpointState
}

export function getVideoState() {
  return { ...apiState.video }
}

export function getVideoStreamUrl() {
  if (!apiState.video?.enabled) {
    return ''
  }

  if (explicitVideoStreamUrl) {
    return explicitVideoStreamUrl
  }

  return resolveVideoUrlFromParts(apiState.video)
}

export async function ensureVideoStreamUrl(options = {}) {
  const { forceDiscovery = false, reason = 'video' } = options

  if (!apiState.video?.enabled) {
    return ''
  }

  if (explicitVideoStreamUrl) {
    return explicitVideoStreamUrl
  }

  if (resolveVideoUrlPromise && !forceDiscovery) {
    return resolveVideoUrlPromise
  }

  const currentUrl = resolveVideoUrlFromParts(apiState.video)
  if (currentUrl && !forceDiscovery) {
    applyResolvedVideoCandidate({
      ...apiState.video,
      url: currentUrl,
      source: apiState.video.source || 'configured'
    })
    return currentUrl
  }

  resolveVideoUrlPromise = (async () => {
    let services = []

    if (shouldDiscoverVideoViaMdns()) {
      try {
        services = await discoverNativeVideoServices(reason)
      } catch (error) {
        apiState.video.discoveryState = 'failed'
        apiState.video.lastError = toErrorMessage(error)
      }
    }

    const candidates = buildVideoCandidates(services, {
      preferCurrent: !forceDiscovery
    })

    for (const candidate of candidates) {
      const resolvedUrl = applyResolvedVideoCandidate(candidate)
      if (resolvedUrl) {
        return resolvedUrl
      }
    }

    apiState.video.discoveryState = 'failed'
    apiState.video.lastError = apiState.video.lastError || '未找到可用的视频流服务'
    return ''
  })()
    .finally(() => {
      resolveVideoUrlPromise = null
    })

  return resolveVideoUrlPromise
}

export function testVideoStreamUrl(videoInput) {
  const normalizedUrl = normalizeManualVideoStreamUrl(videoInput)
  if (!normalizedUrl) {
    throw new Error('请输入有效的视频地址')
  }

  return {
    url: normalizedUrl
  }
}

export function saveManualVideoStreamUrl(videoInput) {
  if (explicitVideoStreamUrl) {
    throw new Error('当前构建已通过环境变量固定视频地址，不能在应用内修改')
  }

  const result = testVideoStreamUrl(videoInput)
  persistManualVideoStreamUrl(result.url)

  apiState.video = {
    ...apiState.video,
    enabled: true,
    url: result.url,
    origin: '',
    host: '',
    port: getPortFromUrl(result.url, defaultVideoConfig().port),
    path: getPathFromUrl(result.url, VIDEO_STREAM_PATH),
    source: 'manual',
    discoveryState: 'manual',
    lastError: '',
    lastResolvedAt: Date.now(),
    manualUrl: result.url,
    isEnvOverride: false,
    canEditUrl: true
  }
  resolveVideoUrlPromise = null

  return result
}

export function clearManualVideoStreamUrl() {
  if (explicitVideoStreamUrl) {
    return getVideoState()
  }

  clearStoredManualVideoStreamUrl()
  apiState.video = {
    ...createStoredVideoConfig({ includeManual: false }),
    lastDiscoveryAt: apiState.video?.lastDiscoveryAt || 0
  }
  resolveVideoUrlPromise = null

  return getVideoState()
}

function buildVideoCandidates(services = [], options = {}) {
  const { preferCurrent = true } = options
  const candidates = []

  if (preferCurrent) {
    addVideoCandidate(candidates, apiState.video)
  }

  for (const service of services) {
    const attributes = service?.attributes && typeof service.attributes === 'object'
      ? service.attributes
      : {}

    addVideoCandidate(candidates, {
      enabled: true,
      source: 'video-mdns',
      serviceName: service.serviceName || '',
      url: attributes.streamUrl || attributes.videoUrl || attributes.url || '',
      origin: attributes.streamOrigin || attributes.videoOrigin || service.originUrl || '',
      host: attributes.streamHost || attributes.videoHost || service.host || '',
      port: parsePositiveInt(
        attributes.streamPort ?? attributes.videoPort ?? service.port,
        service.port || defaultVideoConfig().port
      ),
      path: resolveDiscoveredVideoPath(attributes, defaultVideoConfig().path)
    })
  }

  if (!preferCurrent) {
    addVideoCandidate(candidates, apiState.video)
  }

  return candidates
}

function addVideoCandidate(candidates, candidate) {
  if (!candidate || candidate.enabled === false) {
    return
  }

  const url = resolveVideoUrlFromParts(candidate)
  if (!url) {
    return
  }

  if (candidates.some((item) => item.url === url)) {
    return
  }

  candidates.push({
    ...candidate,
    url,
    origin: normalizeAbsoluteUrl(candidate.origin || ''),
    host: normalizeHost(candidate.host || ''),
    port: parsePositiveInt(candidate.port, defaultVideoConfig().port),
    path: normalizeUrlPath(candidate.path || defaultVideoConfig().path),
    serviceName: candidate.serviceName || ''
  })
}

async function discoverNativeVideoServices(reason) {
  apiState.video.discoveryState = 'discovering'

  const result = await LanDiscovery.discoverService({
    serviceNamePrefix: apiConfig.videoServiceNamePrefix,
    serviceType: apiConfig.videoServiceType,
    timeoutMs: apiConfig.videoDiscoveryTimeoutMs,
    maxResults: 6,
    reason
  })

  apiState.video.lastDiscoveryAt = Number(result?.discoveredAt) || Date.now()
  apiState.video.discoveryState = 'completed'

  if (!Array.isArray(result?.services)) {
    return []
  }

  return result.services
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      serviceName: item.serviceName || '',
      serviceType: item.serviceType || '',
      originUrl: item.originUrl || '',
      path: item.path || '',
      host: item.host || '',
      port: Number(item.port) || 0,
      attributes: item.attributes || {}
    }))
}

function applyResolvedVideoCandidate(candidate) {
  const resolvedUrl = resolveVideoUrlFromParts(candidate)
  if (!resolvedUrl) {
    return ''
  }

  apiState.video = {
    ...apiState.video,
    enabled: candidate.enabled !== false,
    url: resolvedUrl,
    origin: normalizeAbsoluteUrl(candidate.origin || ''),
    host: normalizeHost(candidate.host || ''),
    port: parsePositiveInt(candidate.port, defaultVideoConfig().port),
    path: normalizeUrlPath(candidate.path || defaultVideoConfig().path),
    source: candidate.source || apiState.video.source || 'resolved',
    discoveryState: 'resolved',
    lastError: '',
    lastResolvedAt: Date.now(),
    lastServiceName: candidate.serviceName || apiState.video.lastServiceName || '',
    manualUrl: candidate.source === 'manual' ? resolvedUrl : apiState.video.manualUrl || '',
    isEnvOverride: Boolean(explicitVideoStreamUrl),
    canEditUrl: !explicitVideoStreamUrl
  }

  return resolvedUrl
}

function resolveVideoUrlFromParts(candidate = {}) {
  const directUrl = normalizeAbsoluteUrl(candidate.url || '')
  if (directUrl) {
    return directUrl
  }

  const origin = normalizeAbsoluteUrl(candidate.origin || '')
  if (origin) {
    try {
      const url = new URL(origin)
      const port = parsePositiveInt(candidate.port, Number(url.port) || defaultVideoConfig().port)
      url.port = String(port)
      url.pathname = normalizeUrlPath(candidate.path || defaultVideoConfig().path)
      url.search = ''
      url.hash = ''
      return url.toString()
    } catch {
      return ''
    }
  }

  const host = normalizeHost(candidate.host || '')
  if (!host) {
    return ''
  }

  try {
    const baseUrl = /^https?:\/\//i.test(host)
      ? new URL(host)
      : new URL(`http://${formatHostForUrl(host)}`)
    const port = parsePositiveInt(candidate.port, Number(baseUrl.port) || defaultVideoConfig().port)
    baseUrl.port = String(port)
    baseUrl.pathname = normalizeUrlPath(candidate.path || defaultVideoConfig().path)
    baseUrl.search = ''
    baseUrl.hash = ''
    return baseUrl.toString()
  } catch {
    return ''
  }
}

function shouldDiscoverVideoViaMdns() {
  return Boolean(
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable('LanDiscovery') &&
    apiConfig.videoServiceNamePrefix
  )
}

function resolveDiscoveredVideoPath(attributes, fallback) {
  const path =
    attributes.streamPath ||
    attributes.videoPath ||
    attributes.path ||
    ''

  return normalizeUrlPath(path || fallback)
}

function persistManualVideoStreamUrl(videoUrl) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  window.localStorage.setItem(VIDEO_MANUAL_STORAGE_KEY, videoUrl)
}

function loadManualVideoStreamUrl() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return ''
  }

  return normalizeManualVideoStreamUrl(window.localStorage.getItem(VIDEO_MANUAL_STORAGE_KEY) || '')
}

function clearStoredManualVideoStreamUrl() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  window.localStorage.removeItem(VIDEO_MANUAL_STORAGE_KEY)
}

function normalizeUrlPath(path) {
  const normalized = safeTrim(path)
  if (!normalized) {
    return '/'
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function normalizeAbsoluteUrl(value) {
  const trimmed = safeTrim(value)
  if (!trimmed) {
    return ''
  }

  try {
    const url = new URL(trimmed)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return ''
    }
    return url.toString()
  } catch {
    return ''
  }
}

function normalizeManualVideoStreamUrl(value) {
  const trimmed = safeTrim(value)
  if (!trimmed) {
    return ''
  }

  const prepared = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`

  try {
    const url = new URL(prepared)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return ''
    }

    if (!url.port) {
      url.port = String(getDefaultVideoPort())
    }

    if (!url.pathname || url.pathname === '/') {
      url.pathname = VIDEO_STREAM_PATH
    }

    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function normalizeHost(value) {
  return safeTrim(value)
}

function formatHostForUrl(host) {
  const normalized = normalizeHost(host)
  if (!normalized || normalized.startsWith('[')) {
    return normalized
  }

  const colonCount = (normalized.match(/:/g) || []).length
  return colonCount > 1 ? `[${normalized}]` : normalized
}

function normalizeServiceType(value) {
  const normalized = safeTrim(value)
  if (!normalized) {
    return DEFAULT_SERVICE_TYPE
  }

  return normalized.endsWith('.') ? normalized : `${normalized}.`
}

function createStoredVideoConfig(options = {}) {
  const includeManual = options.includeManual !== false

  if (explicitVideoStreamUrl) {
    return defaultVideoConfig({
      url: explicitVideoStreamUrl,
      port: getPortFromUrl(explicitVideoStreamUrl, getDefaultVideoPort()),
      path: getPathFromUrl(explicitVideoStreamUrl, VIDEO_STREAM_PATH),
      source: 'env',
      discoveryState: 'manual',
      lastResolvedAt: Date.now(),
      isEnvOverride: true,
      canEditUrl: false
    })
  }

  if (includeManual && manualVideoStreamUrl) {
    return defaultVideoConfig({
      url: manualVideoStreamUrl,
      port: getPortFromUrl(manualVideoStreamUrl, getDefaultVideoPort()),
      path: getPathFromUrl(manualVideoStreamUrl, VIDEO_STREAM_PATH),
      source: 'manual',
      discoveryState: 'manual',
      lastResolvedAt: Date.now(),
      manualUrl: manualVideoStreamUrl
    })
  }

  return defaultVideoConfig()
}

function defaultVideoConfig(overrides = {}) {
  return {
    enabled: true,
    url: '',
    origin: '',
    host: '',
    port: getDefaultVideoPort(),
    path: VIDEO_STREAM_PATH,
    source: 'unresolved',
    discoveryState: 'idle',
    lastError: '',
    lastResolvedAt: 0,
    lastDiscoveryAt: 0,
    lastServiceName: '',
    manualUrl: '',
    isEnvOverride: Boolean(explicitVideoStreamUrl),
    canEditUrl: !explicitVideoStreamUrl,
    ...overrides
  }
}

function getPortFromUrl(urlString, fallback) {
  try {
    const url = new URL(urlString)
    return parsePositiveInt(url.port, fallback)
  } catch {
    return fallback
  }
}

function getPathFromUrl(urlString, fallback) {
  try {
    const url = new URL(urlString)
    return normalizeUrlPath(url.pathname || fallback)
  } catch {
    return fallback
  }
}

function getDefaultVideoPort() {
  return Number.isFinite(VIDEO_STREAM_PORT) && VIDEO_STREAM_PORT > 0 ? VIDEO_STREAM_PORT : 5000
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function safeTrim(value) {
  return value == null ? '' : String(value).trim()
}

function toErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }
  return String(error || '')
}
