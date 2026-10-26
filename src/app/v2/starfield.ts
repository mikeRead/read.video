// Starfield: ALL stars in a single Points draw call (V1 used ~24,700 separate
// objects — one geometry + one material per star). Per-vertex color, size and
// twinkle phase; soft glow/cross texture from a small canvas.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SRGBColorSpace
} from 'three'

// Soft radial glow with cross arms — ported from V1's generateStarTexture
function generateStarTexture(size = 128): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const cx = size / 2
  const cy = size / 2
  const r = size / 2
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)')
  grad.addColorStop(0.2, 'rgba(255,255,255,0.8)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.25)')
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  // Cross arms
  ctx.globalCompositeOperation = 'lighter'
  const arm = (angle: number, length: number, width: number) => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    const g = ctx.createLinearGradient(0, 0, length, 0)
    g.addColorStop(0, 'rgba(255,255,255,0.9)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, -width / 2, length, width)
    ctx.restore()
  }
  for (let i = 0; i < 4; i++) arm((Math.PI / 2) * i, r * 0.95, size * 0.04)
  for (let i = 0; i < 4; i++) arm((Math.PI / 2) * i + Math.PI / 4, r * 0.5, size * 0.025)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

// Small soft round dot for dust particles — untextured GL points render as
// hard squares, which read badly when they drift close to the camera
function generateDotTexture(size = 32): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const r = size / 2
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)')
  grad.addColorStop(0.6, 'rgba(255,255,255,0.4)')
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

const STAR_VERT = /* glsl */`
  attribute float size;
  attribute float phase;
  attribute vec3 color;
  uniform float uTime;
  varying vec3 vColor;
  varying float vTwinkle;
  void main(){
    vColor = color;
    // Cheap per-star twinkle in the vertex shader
    vTwinkle = 0.8 + 0.2 * sin(uTime * (0.5 + phase * 2.0) + phase * 6.2831);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(size * (900.0 / -mv.z), 1.0, 64.0);
    gl_Position = projectionMatrix * mv;
  }
`

const STAR_FRAG = /* glsl */`
  uniform sampler2D uMap;
  varying vec3 vColor;
  varying float vTwinkle;
  void main(){
    vec4 tex = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor * tex.rgb * vTwinkle, tex.a);
  }
`

export interface StarfieldOpts {
  sizeMul: number
  /** Writes this star's color into the passed Color */
  pick: (c: Color) => void
}

export interface Starfield {
  points: Points
  dust: Points
  update: (timeSec: number) => void
  dispose: () => void
}

export function createStarfield(starCount: number, dustCount: number, opts: StarfieldOpts): Starfield {
  // --- Main stars: one geometry, one material, one draw call ---
  const positions = new Float32Array(starCount * 3)
  const colors = new Float32Array(starCount * 3)
  const sizes = new Float32Array(starCount)
  const phases = new Float32Array(starCount)

  const c = new Color()
  for (let i = 0; i < starCount; i++) {
    const ix = i * 3
    positions[ix] = (Math.random() - 0.5) * 50000
    positions[ix + 1] = (Math.random() - 0.5) * 20000
    positions[ix + 2] = (Math.random() - 0.5) * 50000

    opts.pick(c)
    colors[ix] = c.r
    colors[ix + 1] = c.g
    colors[ix + 2] = c.b

    sizes[i] = (14 + Math.random() * 14) * opts.sizeMul
    phases[i] = Math.random()
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.setAttribute('size', new BufferAttribute(sizes, 1))
  geometry.setAttribute('phase', new BufferAttribute(phases, 1))

  const texture = generateStarTexture(128)
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMap: { value: texture }
    },
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending
  })

  const points = new Points(geometry, material)
  // Stars span the whole world; skip per-frame frustum tests
  points.frustumCulled = false

  // --- Dust: subtle near-camera parallax particles (V1's pattern, kept) ---
  const dustPositions = new Float32Array(dustCount * 3)
  const dustRange = 3000
  for (let i = 0; i < dustCount; i++) {
    const ix = i * 3
    dustPositions[ix] = (Math.random() - 0.5) * dustRange
    dustPositions[ix + 1] = (Math.random() - 0.5) * dustRange * 0.6
    dustPositions[ix + 2] = (Math.random() - 0.5) * dustRange
  }
  const dustGeometry = new BufferGeometry()
  dustGeometry.setAttribute('position', new BufferAttribute(dustPositions, 3))
  const dotTexture = generateDotTexture()
  const dustMaterial = new PointsMaterial({
    color: 0xffffff,
    size: 2,
    sizeAttenuation: true,
    map: dotTexture,
    transparent: true,
    opacity: 0.12,
    depthWrite: false
  })
  const dust = new Points(dustGeometry, dustMaterial)
  dust.renderOrder = 1
  dust.frustumCulled = false

  return {
    points,
    dust,
    update: (timeSec: number) => {
      material.uniforms.uTime.value = timeSec
    },
    dispose: () => {
      geometry.dispose()
      material.dispose()
      texture.dispose()
      dustGeometry.dispose()
      dustMaterial.dispose()
      dotTexture.dispose()
    }
  }
}
