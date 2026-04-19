import { reactive } from 'vue'
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { LanDiscovery } from '../plugins/lan-discovery'

const API_SUFFIX = '/api'
const HEALTH_SUFFIX = '/health'
const DEFAULT_HEALTH_PATH = '/api/health'
const DEFAULT_SERVICE_TYPE = '_http._tcp.'
const STORAGE_KEY = 'moodpaws.api.baseUrl'

const SERVICE_NAME_PREFIX = safeTrim(import.meta.env.VITE_MDNS_SERVICE_NAME || 'moodpaws-server')
const DISCOVERY_TIMEOUT_MS = Number(import.meta.env.VITE_API_DISCOVERY_TIMEOUT || 3500)
const HEALTHCHECK_TIMEOUT_MS = 1800
const REQUEST_TIMEOUT_MS = 5000

const VIDEO_STREAM_PORT = Number(import.meta.env.VITE_VIDEO_STREAM_PORT || 5000)
const VIDEO_STREAM_PATH = normalizeUrlPath(import.meta.env.VITE_VIDEO_STREAM_PATH || '/video_feed')
const explicitVideoStreamUrl = normalizeAbsoluteUrl(import.meta.env.VITE_VIDEO_STREAM_URL || '')
const VIDEO_SERVICE_NAME_PREFIX = safeTrim(import.meta.env.VITE_VIDEO_MDNS_SERVICE_NAME || 'flocakweb')
const VIDEO_SERVICE_TYPE = normalizeServiceType(
  import.meta.env.VITE_VIDEO_MDNS_SERVICE_TYPE || DEFAULT_SERVICE_TYPE
)
const VIDEO_DISCOVERY_TIMEOUT_MS = Number(import.meta.env.VITE_VIDEO_DISCOVERY_TIMEOUT || 2500)

const defaultVideoConfig = {
  enabled: true,
  url: explicitVideoStreamUrl,
  origin: '',
  host: '',
  port: Number.isFinite(VIDEO_STREAM_PORT) && VIDEO_STREAM_PORT > 0 ? VIDEO_STREAM_PORT : 5000,
  path: VIDEO_STREAM_PATH,
  source: explicitVideoStreamUrl ? 'env' : 'unresolved',
  discoveryState: explicitVideoStreamUrl ? 'manual' : 'idle',
  lastError: '',
  lastResolvedAt: explicitVideoStreamUrl ? Date.now() : 0,
  lastDiscoveryAt: 0,
  lastServiceName: ''
}

const explicitBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || '')
const defaultBaseUrl = resolveDefaultBaseUrl()
const cachedBaseUrl = explicitBaseUrl ? '' : loadStoredBaseUrl()

const apiState = reactive({
  baseUrl: explicitBaseUrl || cachedBaseUrl || defaultBaseUrl,
  source: explicitBaseUrl ? 'env' : cachedBaseUrl ? 'cache' : 'default',
  discoveryState: explicitBaseUrl ? 'manual' : 'idle',
  lastError: '',
  lastResolvedAt: 0,
  lastDiscoveryAt: 0,
  lastDiscoveryReason: '',
  lastServiceName: '',
  lastHealthUrl: '',
  video: { ...defaultVideoConfig }
})

let resolveBaseUrlPromise = null
let resolveVideoUrlPromise = null

export const apiConfig = {
  get baseUrl() {
    return apiState.baseUrl
  },
  pollInterval: Number(import.meta.env.VITE_API_POLL_INTERVAL || 5000),
  serviceNamePrefix: SERVICE_NAME_PREFIX,
  discoveryTimeoutMs: DISCOVERY_TIMEOUT_MS,
  videoServiceNamePrefix: VIDEO_SERVICE_NAME_PREFIX,
  videoServiceType: VIDEO_SERVICE_TYPE,
  videoDiscoveryTimeoutMs: VIDEO_DISCOVERY_TIMEOUT_MS
}

export function getApiBaseUrl() {
  return apiState.baseUrl
}

export function getApiState() {
  return { ...apiState }
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

export function buildApiUrl(path) {
  return `${apiState.baseUrl}${normalizeApiPath(path)}`
}

export async function ensureApiBaseUrl(options = {}) {
  const {
    forceDiscovery = false,
    forceHealthCheck = false,
    reason = 'request'
  } = options

  if (explicitBaseUrl && !forceHealthCheck) {
    return apiState.baseUrl
  }

  if (resolveBaseUrlPromise && !forceDiscovery && !forceHealthCheck) {
    return resolveBaseUrlPromise
  }

  resolveBaseUrlPromise = (async () => {
    const shouldProbeCurrentFirst =
      !forceDiscovery &&
      (!Capacitor.isNativePlatform() || apiState.source !== 'default')

    if (shouldProbeCurrentFirst) {
      try {
        return await validateCandidate({
          baseUrl: apiState.baseUrl,
          source: apiState.source || 'current',
          reason
        })
      } catch (error) {
        apiState.lastError = toErrorMessage(error)
      }
    }

    let services = []
    if (!explicitBaseUrl && Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LanDiscovery')) {
      try {
        services = await discoverNativeServices(reason)
      } catch (error) {
        apiState.discoveryState = 'failed'
        apiState.lastError = toErrorMessage(error)
      }
    }

    const candidates = buildCandidates(services)
    let lastError = null

    for (const candidate of candidates) {
      try {
        return await validateCandidate(candidate)
      } catch (error) {
        lastError = error
      }
    }

    apiState.discoveryState = 'failed'
    apiState.lastError = toErrorMessage(lastError) || '未找到可用的局域网后端服务'
    throw lastError || new Error('未找到可用的局域网后端服务')
  })()
    .finally(() => {
      resolveBaseUrlPromise = null
    })

  return resolveBaseUrlPromise
}

export async function ensureVideoStreamUrl(options = {}) {
  const {
    forceDiscovery = false,
    reason = 'video'
  } = options

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
    if (apiState.video.url !== currentUrl) {
      applyResolvedVideoCandidate({
        ...apiState.video,
        url: currentUrl,
        source: apiState.video.source || 'configured'
      })
    }
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

export async function fetchApiJson(path, options = {}) {
  const requestPath = normalizeApiPath(path)
  const retryDiscovery = options.retryDiscovery !== false
  const baseUrl = await ensureApiBaseUrl({
    reason: `request:${requestPath}`
  })

  try {
    return await requestJsonAbsolute(`${baseUrl}${requestPath}`, REQUEST_TIMEOUT_MS)
  } catch (error) {
    if (!retryDiscovery || explicitBaseUrl) {
      throw error
    }

    const retryBaseUrl = await ensureApiBaseUrl({
      forceDiscovery: true,
      forceHealthCheck: true,
      reason: `retry:${requestPath}`
    })

    return requestJsonAbsolute(`${retryBaseUrl}${requestPath}`, REQUEST_TIMEOUT_MS)
  }
}

function buildCandidates(services = []) {
  const candidates = []

  for (const service of services) {
    addCandidate(candidates, {
      baseUrl: service.baseUrl,
      source: 'mdns',
      reason: 'mdns',
      serviceName: service.serviceName,
      healthUrl: service.healthUrl
    })
  }

  addCandidate(candidates, {
    baseUrl: apiState.baseUrl,
    source: apiState.source || 'current',
    reason: 'current'
  })

  addCandidate(candidates, {
    baseUrl: loadStoredBaseUrl(),
    source: 'cache',
    reason: 'cache'
  })

  addCandidate(candidates, {
    baseUrl: defaultBaseUrl,
    source: 'default',
    reason: 'default'
  })

  return candidates
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
        service.port || defaultVideoConfig.port
      ),
      path: resolveDiscoveredVideoPath(attributes, defaultVideoConfig.path)
    })
  }

  if (!preferCurrent) {
    addVideoCandidate(candidates, apiState.video)
  }

  return candidates
}

function addCandidate(candidates, candidate) {
  const baseUrl = normalizeBaseUrl(candidate.baseUrl || '')
  if (!baseUrl) {
    return
  }

  if (candidates.some((item) => item.baseUrl === baseUrl)) {
    return
  }

  candidates.push({
    ...candidate,
    baseUrl
  })
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
    port: parsePositiveInt(candidate.port, defaultVideoConfig.port),
    path: normalizeUrlPath(candidate.path || defaultVideoConfig.path),
    serviceName: candidate.serviceName || ''
  })
}

async function discoverNativeServices(reason) {
  apiState.discoveryState = 'discovering'
  apiState.lastDiscoveryReason = reason

  const result = await LanDiscovery.discoverBackend({
    serviceNamePrefix: apiConfig.serviceNamePrefix,
    timeoutMs: apiConfig.discoveryTimeoutMs,
    maxResults: 8
  })

  apiState.lastDiscoveryAt = Number(result?.discoveredAt) || Date.now()
  apiState.discoveryState = 'completed'

  if (!Array.isArray(result?.services)) {
    return []
  }

  return result.services
    .filter((item) => item && typeof item === 'object' && normalizeBaseUrl(item.baseUrl))
    .map((item) => ({
      baseUrl: normalizeBaseUrl(item.baseUrl),
      healthUrl: item.healthUrl || '',
      serviceName: item.serviceName || '',
      attributes: item.attributes || {},
      host: item.host || '',
      port: Number(item.port) || 0
    }))
}

async function discoverNativeVideoServices(reason) {
  apiState.video.discoveryState = 'discovering'

  const result = await LanDiscovery.discoverService({
    serviceNamePrefix: apiConfig.videoServiceNamePrefix,
    serviceType: apiConfig.videoServiceType,
    timeoutMs: apiConfig.videoDiscoveryTimeoutMs,
    maxResults: 6
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

async function validateCandidate(candidate) {
  const baseUrl = normalizeBaseUrl(candidate.baseUrl || '')
  if (!baseUrl) {
    throw new Error('后端地址无效')
  }

  const healthUrl = candidate.healthUrl || `${baseUrl}${HEALTH_SUFFIX}`

  try {
    const health = await requestJsonAbsolute(healthUrl, HEALTHCHECK_TIMEOUT_MS)
    if (!isMoodPawsHealth(health)) {
      throw new Error('发现了局域网服务，但它不是 MoodPaws 后端')
    }

    applyResolvedCandidate(candidate, baseUrl, healthUrl, health)
    return baseUrl
  } catch (error) {
    if (candidate.source === 'cache') {
      clearStoredBaseUrl()
    }
    throw error
  }
}

function applyResolvedCandidate(candidate, baseUrl, healthUrl, health) {
  apiState.baseUrl = baseUrl
  apiState.source = candidate.source || 'resolved'
  apiState.discoveryState = candidate.source === 'mdns' ? 'resolved' : apiState.discoveryState
  apiState.lastError = ''
  apiState.lastResolvedAt = Date.now()
  apiState.lastServiceName = candidate.serviceName || health?.discovery?.serviceName || ''
  apiState.lastHealthUrl = healthUrl
  apiState.video = mergeVideoConfig(apiState.video, resolveVideoConfig(candidate, health))

  if (!explicitBaseUrl) {
    persistBaseUrl(baseUrl)
  }
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
    port: parsePositiveInt(candidate.port, defaultVideoConfig.port),
    path: normalizeUrlPath(candidate.path || defaultVideoConfig.path),
    source: candidate.source || apiState.video.source || 'resolved',
    discoveryState: 'resolved',
    lastError: '',
    lastResolvedAt: Date.now(),
    lastServiceName: candidate.serviceName || apiState.video.lastServiceName || ''
  }

  return resolvedUrl
}

async function requestJsonAbsolute(url, timeoutMs) {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      headers: {
        Accept: 'application/json'
      },
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
      responseType: 'json'
    })

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Request failed: ${response.status}`)
    }

    return response.data
  }

  const controller = typeof AbortController === 'undefined' ? null : new AbortController()
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json'
      },
      signal: controller?.signal
    })

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Request timed out')
    }
    throw error
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
    }
  }
}

function isMoodPawsHealth(payload) {
  return Boolean(payload && payload.ok === true && payload.service === 'moodpaws-server')
}

function persistBaseUrl(baseUrl) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, baseUrl)
}

function loadStoredBaseUrl() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return ''
  }

  return normalizeBaseUrl(window.localStorage.getItem(STORAGE_KEY) || '')
}

function clearStoredBaseUrl() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
}

function resolveDefaultBaseUrl() {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:3001/api'
  }

  const { hostname, protocol } = window.location

  if (!hostname || protocol === 'capacitor:' || protocol === 'file:') {
    return 'http://127.0.0.1:3001/api'
  }

  return normalizeBaseUrl(`http://${hostname}:3001/api`)
}

function resolveVideoConfig(candidate, health) {
  const healthVideo = health && typeof health.video === 'object' ? health.video : null
  const attributes = candidate?.attributes && typeof candidate.attributes === 'object'
    ? candidate.attributes
    : {}

  const enabledValue =
    healthVideo?.enabled ??
    parseBooleanString(attributes.video) ??
    defaultVideoConfig.enabled

  const url = normalizeAbsoluteUrl(healthVideo?.url || attributes.videoUrl || '')
  const origin = normalizeAbsoluteUrl(healthVideo?.origin || attributes.videoOrigin || '')
  const host = normalizeHost(healthVideo?.host || attributes.videoHost || '')
  const port = parsePositiveInt(healthVideo?.port ?? attributes.videoPort, defaultVideoConfig.port)
  const path = normalizeUrlPath(healthVideo?.path || attributes.videoPath || defaultVideoConfig.path)
  const hasEndpoint = Boolean(url || origin || host)

  return {
    enabled: Boolean(enabledValue),
    url,
    origin,
    host,
    port,
    path,
    source: hasEndpoint ? 'backend-config' : '',
    discoveryState: hasEndpoint ? 'resolved' : 'idle',
    lastError: '',
    lastResolvedAt: hasEndpoint ? Date.now() : 0,
    lastServiceName: candidate?.serviceName || health?.discovery?.serviceName || ''
  }
}

function mergeVideoConfig(current, incoming) {
  const preserveResolvedVideo = hasVideoEndpoint(current) && !hasVideoEndpoint(incoming)

  return {
    ...current,
    ...incoming,
    enabled: preserveResolvedVideo ? current.enabled : incoming.enabled ?? current.enabled,
    url: preserveResolvedVideo
      ? current.url
      : normalizeAbsoluteUrl(incoming.url || ''),
    origin: preserveResolvedVideo
      ? current.origin || ''
      : normalizeAbsoluteUrl(incoming.origin || ''),
    host: preserveResolvedVideo
      ? current.host || ''
      : normalizeHost(incoming.host || ''),
    port: parsePositiveInt(incoming.port, current.port || defaultVideoConfig.port),
    path: normalizeUrlPath(incoming.path || current.path || defaultVideoConfig.path),
    source: preserveResolvedVideo ? current.source : incoming.source || current.source,
    discoveryState: preserveResolvedVideo
      ? current.discoveryState
      : incoming.discoveryState || current.discoveryState,
    lastError: incoming.lastError || (preserveResolvedVideo ? current.lastError : ''),
    lastResolvedAt: preserveResolvedVideo
      ? current.lastResolvedAt || 0
      : incoming.lastResolvedAt || 0,
    lastDiscoveryAt: incoming.lastDiscoveryAt || current.lastDiscoveryAt || 0,
    lastServiceName: preserveResolvedVideo
      ? current.lastServiceName || ''
      : incoming.lastServiceName || current.lastServiceName || ''
  }
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
      const port = parsePositiveInt(candidate.port, Number(url.port) || defaultVideoConfig.port)
      url.port = String(port)
      url.pathname = normalizeUrlPath(candidate.path || defaultVideoConfig.path)
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
    const port = parsePositiveInt(candidate.port, Number(baseUrl.port) || defaultVideoConfig.port)
    baseUrl.port = String(port)
    baseUrl.pathname = normalizeUrlPath(candidate.path || defaultVideoConfig.path)
    baseUrl.search = ''
    baseUrl.hash = ''
    return baseUrl.toString()
  } catch {
    return ''
  }
}

function hasVideoEndpoint(candidate = {}) {
  return Boolean(
    normalizeAbsoluteUrl(candidate.url || '') ||
    normalizeAbsoluteUrl(candidate.origin || '') ||
    normalizeHost(candidate.host || '')
  )
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
    (isLikelyVideoPath(attributes.path) ? attributes.path : '')

  return normalizeUrlPath(path || fallback)
}

function isLikelyVideoPath(path) {
  const rawPath = safeTrim(path)
  if (!rawPath) {
    return false
  }

  const normalized = normalizeUrlPath(rawPath)
  return normalized !== DEFAULT_HEALTH_PATH
}

function normalizeBaseUrl(value) {
  const trimmed = safeTrim(value).replace(/\/+$/, '')
  if (!trimmed) {
    return ''
  }

  if (trimmed.endsWith(`${API_SUFFIX}${HEALTH_SUFFIX}`)) {
    return trimmed.slice(0, -HEALTH_SUFFIX.length)
  }

  if (trimmed.endsWith(API_SUFFIX)) {
    return trimmed
  }

  return `${trimmed}${API_SUFFIX}`
}

function normalizeApiPath(path) {
  if (!path) {
    return '/'
  }

  return path.startsWith('/') ? path : `/${path}`
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

function parseBooleanString(value) {
  if (typeof value === 'boolean') {
    return value
  }

  const normalized = safeTrim(value).toLowerCase()
  if (!normalized) {
    return null
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }

  return null
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
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
