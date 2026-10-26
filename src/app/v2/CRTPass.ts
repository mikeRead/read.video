// Combined CRT pass: film grain + scanlines + vignette + chroma aberration +
// glitch bands + brightness, in ONE fullscreen pass. Replaces V1's two passes
// (an identity color pass that only multiplied by 1.5, plus FilmGrainPass).
// Constant uniforms are set once; only time/glitch state updates per frame.
// Shader time is wrapped to avoid the float-precision grain degradation V1 had.
import { Color, ShaderMaterial } from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

const VERT = /* glsl */`
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAG = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tDiffuse;

  uniform float time;           // wrapped on the CPU, stays small
  uniform float brightness;
  uniform float noiseIntensity;
  uniform float scanlineIntensity;
  uniform float scanlineCount;
  uniform float vignette;
  uniform float chroma;
  uniform float glitchStrength;
  uniform float glitchBandHeight;
  uniform float glitchActive;
  uniform float glitchSeed;
  uniform float glitchScrollSpeed;
  uniform float glitchCount;
  uniform float fadeAmount;
  uniform vec3 fadeColor;

  float rand(vec2 co){
    return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
  }

  void main(){
    vec2 uv = vUv;

    // Horizontal tear/glitch bands (uniform-branched: free when inactive)
    float bandMask = 0.0;
    if (glitchActive > 0.5) {
      float dirRand = fract(sin(glitchSeed * 11.7) * 43758.5453);
      float dir = dirRand > 0.5 ? 1.0 : -1.0;
      for (int i = 0; i < 5; i++) {
        if (float(i) < glitchCount) {
          float base = fract(sin((glitchSeed + float(i) * 7.123 + 1.0) * 12.9898) * 78.233);
          float y = fract(base + dir * time * glitchScrollSpeed);
          float bw = glitchBandHeight * mix(1.0, 0.6, fract(float(i) * 0.37));
          float band = smoothstep(bw, 0.0, abs(uv.y - y));
          bandMask = max(bandMask, band);
        }
      }
      float dirJitter = (rand(vec2(glitchSeed, vUv.y)) - 0.5) * 2.0;
      uv.x += bandMask * glitchStrength * dirJitter * sin(time * 90.0);
    }

    vec2 center = uv - 0.5;
    vec4 col;
    if (chroma > 0.0) {
      vec2 dir2 = normalize(center + 1e-6) * length(center);
      col.r = texture2D(tDiffuse, uv + dir2 * chroma).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir2 * chroma).b;
      col.a = 1.0;
    } else {
      col = vec4(texture2D(tDiffuse, uv).rgb, 1.0);
    }

    col.rgb *= brightness;

    // Film grain — offsets stay in [0,1) so precision never degrades
    float n = rand(uv + vec2(fract(time * 1.231), fract(time * 2.123)));
    float grainIntensity = glitchActive > 0.5 ? noiseIntensity * 3.0 : noiseIntensity;
    col.rgb += (n - 0.5) * grainIntensity;

    if (scanlineIntensity > 0.0) {
      float scan = sin(uv.y * scanlineCount + time * 6.28318);
      col.rgb -= scanlineIntensity * 0.5 * (scan * 0.5 + 0.5);
    }

    // Slight darken within glitch bands for visibility
    col.rgb = mix(col.rgb, col.rgb * 0.8, bandMask * 0.6);

    if (vignette > 0.0) {
      float v = smoothstep(0.8, 0.2, length(center));
      col.rgb *= mix(1.0, v, vignette);
    }

    // Scene-transition fade (atmosphere dive)
    col.rgb = mix(col.rgb, fadeColor, fadeAmount);

    gl_FragColor = col;
  }
`

export interface CRTOptions {
  mobile: boolean
  /** Constant subtle chroma aberration outside glitches (desktop only) */
  baseChroma?: number
}

export interface CRTPass {
  pass: ShaderPass
  /** Per-frame update: advances time, schedules + animates glitches */
  update: (nowMs: number) => void
  /** Scene-transition fade: amount 0 (none) to 1 (solid color) */
  setFade: (amount: number, color?: Color) => void
  dispose: () => void
}

export function createCRTPass({ mobile, baseChroma = 0 }: CRTOptions): CRTPass {
  // Chroma reads 2 extra texture fetches per pixel — keep mobile at zero
  const restChroma = mobile ? 0 : baseChroma
  const material = new ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      time: { value: 0 },
      brightness: { value: 1.5 },
      // Heavier grain/glitch on mobile (matches V1's tuning); no scanlines (too much)
      noiseIntensity: { value: mobile ? 0.2 : 0.07 },
      scanlineIntensity: { value: 0 },
      scanlineCount: { value: 720 },
      vignette: { value: 0.5 },
      chroma: { value: restChroma },
      glitchStrength: { value: mobile ? 0.22 : 0.055 },
      glitchBandHeight: { value: 0.045 },
      glitchActive: { value: 0 },
      glitchSeed: { value: 0 },
      glitchScrollSpeed: { value: 0.9 },
      glitchCount: { value: 2 },
      fadeAmount: { value: 0 },
      fadeColor: { value: new Color(0, 0, 0) }
    },
    vertexShader: VERT,
    fragmentShader: FRAG
  })

  const pass = new ShaderPass(material)
  pass.renderToScreen = true
  const u = material.uniforms

  // Glitch scheduling (ported from V1: random 1-10s interval, 0.3-0.6s bursts)
  let nextGlitchAt = performance.now() + 1000 + Math.random() * 4000
  let glitchEndAt = 0
  let glitchStartedAt = 0
  let glitchDuration = 1

  const update = (nowMs: number) => {
    // Wrap time at 1 hour — keeps float precision healthy in the shader
    u.time.value = (nowMs % 3600000) * 0.001

    if (nowMs >= nextGlitchAt) {
      u.glitchActive.value = 1
      u.glitchSeed.value = Math.random() * 1000
      u.glitchCount.value = 1 + Math.floor(Math.random() * 5)
      u.glitchScrollSpeed.value = 0.7 + Math.random() * 0.4
      glitchDuration = 300 + Math.random() * 300
      glitchStartedAt = nowMs
      glitchEndAt = nowMs + glitchDuration
      nextGlitchAt = nowMs + 1000 + Math.random() * 9000
    }

    if (u.glitchActive.value > 0) {
      if (nowMs >= glitchEndAt) {
        u.glitchActive.value = 0
        u.chroma.value = restChroma
      } else if (!mobile) {
        // Pulsing chroma aberration during the glitch (desktop only, like V1)
        const progress = (nowMs - glitchStartedAt) / glitchDuration
        const pulse = Math.sin(progress * Math.PI * 8) * 0.5 + 0.5
        u.chroma.value = 0.01 + 0.01 * pulse
      }
    }
  }

  return {
    pass,
    update,
    setFade: (amount, color) => {
      u.fadeAmount.value = amount
      if (color) (u.fadeColor.value as Color).copy(color)
    },
    dispose: () => material.dispose()
  }
}
