import { Capacitor, CapacitorHttp } from '@capacitor/core'
import CryptoJS from 'crypto-js'
import { aliyunIotConfig, getAliyunIotEndpoint } from '../../config/aliyun-iot'

const API_VERSION = '2018-01-20'
const SIGNATURE_METHOD = 'HMAC-SHA1'
const SIGNATURE_VERSION = '1.0'
const REQUEST_TIMEOUT_MS = 12000

export async function queryDevicePropertyStatus(deviceName) {
  return requestIotOpenApi(resolveStatusAction(), {
    ProductKey: aliyunIotConfig.productKey,
    DeviceName: deviceName
  })
}

export async function queryDevicePropertyHistory(options) {
  const {
    deviceName,
    identifier,
    startTime,
    endTime,
    pageSize = aliyunIotConfig.historyPageSize,
    nextPageToken = ''
  } = options

  const params = {
    ProductKey: aliyunIotConfig.productKey,
    DeviceName: deviceName,
    Identifier: identifier,
    StartTime: String(startTime),
    EndTime: String(endTime),
    Asc: '1',
    PageSize: String(pageSize)
  }

  if (nextPageToken) {
    params.NextPageToken = nextPageToken
  }

  return requestIotOpenApi(resolveHistoryAction(), params)
}

export async function requestIotOpenApi(action, params = {}) {
  const signedUrl = createSignedUrl(action, params)
  const payload = await requestJson(signedUrl)
  assertOpenApiSuccess(payload, action)
  return payload
}

function createSignedUrl(action, params) {
  const queryParams = removeEmptyValues({
    Format: 'JSON',
    Version: API_VERSION,
    AccessKeyId: aliyunIotConfig.accessKeyId,
    SignatureMethod: SIGNATURE_METHOD,
    Timestamp: createIsoTimestamp(),
    SignatureVersion: SIGNATURE_VERSION,
    SignatureNonce: createNonce(),
    RegionId: aliyunIotConfig.regionId,
    IotInstanceId: aliyunIotConfig.iotInstanceId,
    Action: action,
    ...params
  })
  const canonicalizedQueryString = Object.keys(queryParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(queryParams[key])}`)
    .join('&')
  const stringToSign = `GET&%2F&${percentEncode(canonicalizedQueryString)}`
  const signature = CryptoJS.enc.Base64.stringify(
    CryptoJS.HmacSHA1(stringToSign, `${aliyunIotConfig.accessKeySecret}&`)
  )
  const requestQueryString = `${canonicalizedQueryString}&Signature=${percentEncode(signature)}`

  return `${getAliyunIotEndpoint()}?${requestQueryString}`
}

async function requestJson(url) {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      headers: {
        Accept: 'application/json'
      },
      connectTimeout: REQUEST_TIMEOUT_MS,
      readTimeout: REQUEST_TIMEOUT_MS,
      responseType: 'json'
    })

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`阿里云请求失败：HTTP ${response.status}`)
    }

    return normalizeResponseData(response.data)
  }

  const controller = typeof AbortController === 'undefined' ? null : new AbortController()
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    : null

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal
    })

    if (!response.ok) {
      throw new Error(`阿里云请求失败：HTTP ${response.status}`)
    }

    return response.json()
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('阿里云请求超时')
    }
    throw error
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
    }
  }
}

function assertOpenApiSuccess(payload, action) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`阿里云 ${action} 返回为空`)
  }

  if (payload.Success === false || payload.Code || payload.Message && payload.Success !== true) {
    const message = payload.Message || payload.Code || `${action} 调用失败`
    throw new Error(`阿里云 ${action}：${message}`)
  }
}

function normalizeResponseData(data) {
  if (typeof data !== 'string') {
    return data
  }

  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

function resolveStatusAction() {
  return aliyunIotConfig.queryMode === 'original'
    ? 'QueryDeviceOriginalPropertyStatus'
    : 'QueryDevicePropertyStatus'
}

function resolveHistoryAction() {
  return aliyunIotConfig.queryMode === 'original'
    ? 'QueryDeviceOriginalPropertyData'
    : 'QueryDevicePropertyData'
}

function createIsoTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function createNonce() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function removeEmptyValues(params) {
  return Object.entries(params).reduce((result, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      result[key] = String(value)
    }
    return result
  }, {})
}

function percentEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}
