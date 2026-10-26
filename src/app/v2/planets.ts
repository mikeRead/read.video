// Random colorful planets — solid bright colors (they pop against the nebula),
// shader rings, optional atmospheric halo sprites, and an optional striped
// vaporwave sun as the hero planet. One shared unit sphere + ring geometry +
// halo texture; per-planet scale.
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Material,
  Mesh,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  Vector3
} from 'three'
import type { StylePreset } from './styles'

// Every planet: smooth two-tone vertical gradient (the vapor-sun look, no
// stripe slits) + soft lambert shading from a fixed sun direction + a hint of
// rim light so it reads as a sphere. The shaded side also keeps the ×1.5
// post-brightness from clipping bright colors to white.
const PLANET_VERT = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vY;
  void main(){
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    vY = position.y; // unit sphere: [-1, 1]
    gl_Position = projectionMatrix * mv;
  }
`

const PLANET_FRAG = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vY;
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform float uOpacity;
  void main(){
    float t = clamp(vY * 0.5 + 0.5, 0.0, 1.0);
    vec3 base = mix(uBottom, uTop, smoothstep(0.0, 1.0, t));
    // Mostly flat, stylized: shallow shading range for just a hint of form
    float light = 0.8 + 0.2 * max(dot(vNormal, normalize(vec3(0.55, 0.45, 0.7))), 0.0);
    vec3 col = base * light;
    // Gentle rim lift toward the halo
    float fres = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
    col += base * fres * 0.25;
    gl_FragColor = vec4(col, uOpacity);
  }
`

const RING_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Concentric bands with soft inner/outer falloff
const RING_FRAG = /* glsl */`
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uSeed;
  uniform float uOpacity;
  float hash(float p){ return fract(sin(p * 127.1 + 311.7) * 43758.5453); }
  void main(){
    // RingGeometry UVs are planar: radial distance spans [inner/outer, 1].
    // Normalize to [0,1] across the ring width (inner 1.2 / outer 1.9).
    float r = length(vUv - 0.5) * 2.0;
    float rn = clamp((r - 0.6316) / (1.0 - 0.6316), 0.0, 1.0);
    float bands = 0.6 + 0.4 * hash(floor(rn * 24.0) + uSeed);
    float edge = smoothstep(0.0, 0.12, rn) * smoothstep(1.0, 0.85, rn);
    gl_FragColor = vec4(uColor * bands, edge * bands * uOpacity);
  }
`

const brightColor = () => new Color().setHSL(Math.random(), 0.9, 0.65)

// Soft radial falloff for atmospheric halos (shared by all planets)
function makeHaloTexture(size = 128): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const r = size / 2
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0.0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export interface PlanetInfo {
  position: Vector3
  radius: number
  top: Color
  bottom: Color
  /** The smooth gradient sphere — crossfaded out while its detailed
      procedural surface is revealed up close */
  mesh: Mesh
  material: ShaderMaterial
}

export interface PlanetSystem {
  group: Group
  /** Dive targets for the atmosphere-entry cinematic */
  infos: PlanetInfo[]
  update: (dtSec: number) => void
  dispose: () => void
}

export function createPlanets(
  planetCount: number,
  segments: number,
  baseHue: number | null,
  style: StylePreset['planets']
): PlanetSystem {
  const group = new Group()
  // ONE unit sphere + ONE unit ring shared by every planet/moon/ring
  const sphereGeo = new SphereGeometry(1, segments, segments)
  const ringGeo = new RingGeometry(1.2, 1.9, 48)

  const materials: Material[] = []
  const textures: Texture[] = []
  const infos: PlanetInfo[] = []
  const haloTex = style.glow > 0 ? makeHaloTexture() : null
  if (haloTex) textures.push(haloTex)

  // Stylized solid color: same hue top to bottom, with only the faintest
  // lightness shift — just enough 3D pop to not be a flat disc.
  const gradientPair = (): [Color, Color] => {
    const h = style.pickHue(baseHue)
    return [
      new Color().setHSL(h, style.sat, Math.min(style.light + 0.02, 0.68)),
      new Color().setHSL(h, style.sat, Math.max(style.light - 0.03, 0.3))
    ]
  }

  const gradientMaterial = (top: Color, bottom: Color) =>
    new ShaderMaterial({
      uniforms: { uTop: { value: top }, uBottom: { value: bottom }, uOpacity: { value: 1 } },
      vertexShader: PLANET_VERT,
      fragmentShader: PLANET_FRAG
    })

  const addHalo = (color: Color, size: number, x: number, y: number, z: number) => {
    if (!haloTex || style.glow <= 0) return
    const mat = new SpriteMaterial({
      map: haloTex,
      color,
      transparent: true,
      opacity: 0.4 * style.glow,
      blending: AdditiveBlending,
      depthWrite: false
    })
    materials.push(mat)
    const halo = new Sprite(mat)
    halo.scale.setScalar(size * 3.2)
    halo.position.set(x, y, z)
    halo.renderOrder = 2
    group.add(halo)
  }

  const addPlanet = (size: number, x: number, y: number, z: number, hero: boolean) => {
    // Hero in vapor style gets the iconic sunset pair; everything else rolls
    // its own gradient from the style palette
    const [top, bottom] = hero && style.vaporSun
      ? [new Color().setHSL(0.12, 1.0, 0.65), new Color().setHSL(0.89, 0.95, 0.55)]
      : gradientPair()
    const planetMat = gradientMaterial(top, bottom)
    const haloColor = bottom
    materials.push(planetMat)

    const planet = new Mesh(sphereGeo, planetMat)
    planet.scale.setScalar(size)
    planet.position.set(x, y, z)
    group.add(planet)
    addHalo(haloColor, size, x, y, z)
    infos.push({ position: new Vector3(x, y, z), radius: size, top, bottom, mesh: planet, material: planetMat })

    const tilt = Math.random() * Math.PI * 2

    // Rings
    if (!(hero && style.vaporSun) && Math.random() < style.ringChance) {
      const ringMat = new ShaderMaterial({
        uniforms: {
          uColor: { value: brightColor() },
          uSeed: { value: Math.random() * 100 },
          uOpacity: { value: 0.6 }
        },
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        side: DoubleSide,
        transparent: true,
        depthWrite: false
      })
      materials.push(ringMat)
      const ring = new Mesh(ringGeo, ringMat)
      ring.scale.setScalar(size)
      ring.position.copy(planet.position)
      ring.rotation.x = tilt
      group.add(ring)
    } else if (!hero && Math.random() < 0.5) {
      // Moon
      const [moonTop, moonBottom] = gradientPair()
      const moonMat = gradientMaterial(moonTop, moonBottom)
      const moonColor = moonBottom
      materials.push(moonMat)
      const moon = new Mesh(sphereGeo, moonMat)
      const mx = x + (size * 2 + Math.random() * size)
      const my = y + (Math.random() - 0.5) * size
      const mz = z + (size * 2 + Math.random() * size) * (Math.random() > 0.5 ? -1 : 1)
      moon.scale.setScalar(size / 6)
      moon.position.set(mx, my, mz)
      group.add(moon)
      addHalo(moonColor, size / 6, mx, my, mz)
    }
  }

  // Background planets (V1's distribution: wide XZ spread, thin Y band)
  for (let i = 0; i < planetCount; i++) {
    addPlanet(
      Math.random() * 150 + 50,
      (Math.random() - 0.5) * 20000,
      (Math.random() - 0.5) * 3000,
      (Math.random() - 0.5) * 20000,
      false
    )
  }

  // Hero planet near the camera start (the vaporwave sun, when styled)
  addPlanet(
    Math.random() * 150 + 120,
    (Math.random() - 0.5) * 600,
    (Math.random() - 0.5) * 300,
    -800 - Math.random() * 600,
    true
  )

  return {
    group,
    infos,
    // Solid-color spheres have no visible rotation; nothing to animate
    update: () => {},
    dispose: () => {
      sphereGeo.dispose()
      ringGeo.dispose()
      for (const m of materials) m.dispose()
      for (const t of textures) t.dispose()
    }
  }
}
