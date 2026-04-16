import { amapConfig } from '../../config/amap'

let amapPromise = null

export function loadAmap() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('AMap can only load in the browser'))
  }

  if (window.AMap) {
    return Promise.resolve(window.AMap)
  }

  if (amapPromise) {
    return amapPromise
  }

  amapPromise = new Promise((resolve, reject) => {
    window._AMapSecurityConfig = {
      securityJsCode: amapConfig.securityJsCode
    }

    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=${amapConfig.version}&key=${amapConfig.webKey}`
    script.async = true
    script.onload = () => {
      if (window.AMap) {
        resolve(window.AMap)
        return
      }

      reject(new Error('AMap script loaded but global object is missing'))
    }
    script.onerror = () => {
      reject(new Error('Failed to load AMap script'))
    }

    document.head.appendChild(script)
  })

  return amapPromise
}
