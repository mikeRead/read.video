import { ShaderMaterial, UniformsUtils } from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

export function FilmGrainPass(options: Record<string, unknown> = {}) {
  const {
    noiseIntensity = 0.15,
    scanlineIntensity = 0.08,
    scanlineCount = 800.0,
    vignette = 0.4,
    chroma = 0.0015,
    jitter = 0.001,
    glitchInterval = 5.0,
    glitchDuration = 0.12,
    glitchStrength = 0.02,
    glitchBandHeight = 0.01,
    glitchScrollSpeed = 0.25,
    getGlitchIntervalSeconds,
    getGlitchDurationSeconds,

  } = options

  const asFn = (value: unknown) => typeof value === 'function' ? value : () => value

  const providers = {
    noiseIntensity: asFn(noiseIntensity),
    scanlineIntensity: asFn(scanlineIntensity),
    scanlineCount: asFn(scanlineCount),
    vignette: asFn(vignette),
    chroma: asFn(chroma),
    jitter: asFn(jitter),
    glitchStrength: asFn(glitchStrength),
    glitchBandHeight: asFn(glitchBandHeight),
    glitchScrollSpeed: asFn(glitchScrollSpeed),
    getGlitchIntervalMs: (() => {
      if (typeof getGlitchIntervalSeconds === 'function') {
        return Math.max(0, getGlitchIntervalSeconds() * 1000)
      }
      const secVal = asFn(glitchInterval)()
      return Math.max(0, secVal * 1000)
    }),
    getGlitchDurationMs: (() => {
      if (typeof getGlitchDurationSeconds === 'function') {
        return Math.max(0, getGlitchDurationSeconds() * 1000)
      }
      const secVal = asFn(glitchDuration)()
      return Math.max(0, secVal * 1000)
    })
  }
  const uniforms = {
    tDiffuse: { value: null as unknown },

    time: { value: 0 },
    noiseIntensity: { value: 0 },
    scanlineIntensity: { value: 0 },
    scanlineCount: { value: 0 },
    vignette: { value: 0 },
    chroma: { value: 0 },

    jitter: { value: 0 },
    glitchInterval: { value: 0 },
    glitchDuration: { value: 0 },
    glitchStrength: { value: 0 },
    glitchBandHeight: { value: 0 },
    glitchActive: { value: 0.0 },
    glitchSeed: { value: 0.0 },
    glitchScrollSpeed: { value: glitchScrollSpeed },
    glitchCount: { value: 2.0 }
  }

  const material = new ShaderMaterial({
    uniforms: UniformsUtils.clone(uniforms),
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
       varying vec2 vUv;
       uniform sampler2D tDiffuse;
       
       uniform float time;
      uniform float noiseIntensity;
      uniform float scanlineIntensity;
      uniform float scanlineCount;
             uniform float vignette;
       uniform float chroma;
       
       uniform float jitter;
      uniform float glitchInterval; // kept for API compatibility, not used in shader
      uniform float glitchDuration; // kept for API compatibility, not used in shader
      uniform float glitchStrength;
      uniform float glitchBandHeight;
      uniform float glitchActive;
      uniform float glitchSeed;
      uniform float glitchScrollSpeed;
      uniform float glitchCount;

             float rand(vec2 co){
         return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
       }

       

       void main(){
        float vy = sin(time * 14.0) * jitter;
        vec2 uv = vec2(vUv.x, vUv.y + vy);

        // brief horizontal tear/glitch bands controlled by uniforms (driven from JS)
        float bandMask = 0.0;
        if (glitchActive > 0.5) {
          // One shared direction for all bands during this glitch (random via seed)
          float dirRand = fract(sin(glitchSeed * 11.7) * 43758.5453);
          float dir = dirRand > 0.5 ? 1.0 : -1.0;
          float bwBase = glitchBandHeight;
          // Render up to 5 bands; actual count controlled by glitchCount
          for (int i = 0; i < 5; i++) {
            if (float(i) < glitchCount) {
              float base = fract(sin((glitchSeed + float(i) * 7.123 + 1.0) * 12.9898) * 78.233);
              float y = fract(base + dir * time * glitchScrollSpeed);
              float bw = bwBase * mix(1.0, 0.6, fract(float(i) * 0.37));
              float band = smoothstep(bw, 0.0, abs(uv.y - y));
              bandMask = max(bandMask, band);
            }
          }
          float dirJitter = (rand(vec2(glitchSeed, vUv.y)) - 0.5) * 2.0;
          uv.x += bandMask * glitchStrength * dirJitter * sin(time * 90.0);
                 }
                  vec2 center = uv - 0.5;
         // Simple chroma aberration
         vec2 dir = normalize(center + 1e-6) * length(center);
         vec4 col;
         col.r = texture2D(tDiffuse, uv + dir * chroma).r;
         col.g = texture2D(tDiffuse, uv + dir * 0.0).g;
         col.b = texture2D(tDiffuse, uv + dir * (-chroma)).b;
        col.a = 1.0;

        float n = rand(uv * (time * 60.0) + vec2(time*1.231, time*2.123));
        // Increase film grain by 2x when glitch is active
        float grainIntensity = glitchActive > 0.5 ? noiseIntensity * 5.0 : noiseIntensity;
        col.rgb += (n - 0.5) * grainIntensity;

        float scan = sin(uv.y * scanlineCount + time * 6.28318);
        col.rgb -= scanlineIntensity * 0.5 * (scan * 0.5 + 0.5);

        // slight darken within glitch band for visibility
        col.rgb = mix(col.rgb, col.rgb * 0.8, bandMask * 0.6);

        if (vignette > 0.0) {
          float v = smoothstep(0.8, 0.2, length(center));
          col.rgb *= mix(1.0, v, vignette);
        }

        gl_FragColor = col;
      }
    `
  })

  const pass = new ShaderPass(material)
  // Initialize uniforms from providers immediately
  const u = (material as { uniforms: Record<string, { value: unknown }> }).uniforms
  u.noiseIntensity.value = providers.noiseIntensity()
  u.scanlineIntensity.value = providers.scanlineIntensity()
  u.scanlineCount.value = providers.scanlineCount()
  u.vignette.value = providers.vignette()
  u.chroma.value = providers.chroma()
  u.jitter.value = providers.jitter()
  u.glitchStrength.value = providers.glitchStrength()
  u.glitchBandHeight.value = providers.glitchBandHeight()
  u.glitchScrollSpeed.value = providers.glitchScrollSpeed()
    // Expose providers for runtime updates
    ; (pass as { userData?: Record<string, unknown> }).userData = {
      ...(pass as { userData?: Record<string, unknown> }).userData,
      providers
    }
  return pass
}


