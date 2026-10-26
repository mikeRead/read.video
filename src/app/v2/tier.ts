// Quality tier — real mobile reductions (per MOBILE_DEBUG.md), computed once.

export interface Tier {
  mobile: boolean
  dprCap: number
  starCount: number
  dustCount: number
  planetCount: number
  msaaSamples: number
  nebulaFaceSize: number
  sphereSegments: number
  precision: 'highp' | 'mediump'
}

let cached: Tier | null = null

const isMobileDevice = () => {
  // ?phone=true keeps the existing PC-testing escape hatch
  if (new URLSearchParams(window.location.search).get('phone') === 'true') return true
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export function getTier(): Tier {
  if (cached) return cached
  const mobile = isMobileDevice()
  cached = mobile
    ? {
      mobile,
      dprCap: 1.5,
      starCount: 15000,
      dustCount: 2500,
      planetCount: 8,
      msaaSamples: 0,
      nebulaFaceSize: 256,
      sphereSegments: 16,
      precision: 'mediump'
    }
    : {
      mobile,
      dprCap: 2,
      starCount: 25000,
      dustCount: 4000,
      planetCount: 15,
      msaaSamples: 4,
      nebulaFaceSize: 512,
      sphereSegments: 32,
      precision: 'highp'
    }
  return cached
}
