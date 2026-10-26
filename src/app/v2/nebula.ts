// Procedural nebula, baked once at init into a cubemap skybox.
// V1 evaluated this shader (~322 sin() per pixel) every frame full-screen;
// here it runs once for 6 small faces, then it's a plain texture lookup.
import {
  BackSide,
  BoxGeometry,
  Color,
  CubeCamera,
  CubeTextureLoader,
  HalfFloatType,
  Mesh,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLCubeRenderTarget,
  type Texture,
  type WebGLRenderer
} from 'three'

const rand = (a = 0, b = 1) => a + Math.random() * (b - a)

function hsl(h: number, s: number, l: number) {
  const c = new Color()
  c.setHSL((((h % 360) + 360) % 360) / 360, s, l)
  return c
}

// Same palette construction as V1: two similar dark tones + two accents
function makePalette(baseHue: number) {
  const s0 = 0.50 + rand(-0.04, 0.04)
  const s1 = 0.50 + rand(-0.06, 0.06)
  const l0 = 0.18 + rand(-0.02, 0.02)
  const l1 = 0.14 + rand(-0.02, 0.02)
  const c0 = hsl(baseHue, s0, l0)
  const c1 = hsl(baseHue + rand(-28, 28), s1, l1)
  return {
    colors: [c0, c1, c1, c0],
    accent: hsl(baseHue, 0.65, 0.40),
    accent2: hsl(baseHue, 0.25, 0.85)
  }
}

const NEBULA_VERT = /* glsl */`
  varying vec3 vDir;
  void main(){
    vec4 w = modelMatrix * vec4(position,1.0);
    vDir = normalize(w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

// V1's fragment shader — affordable because it runs exactly once (the bake).
// On mobile the octave count and second worley layer are reduced: the bake is
// one-time, but weak GPUs still appreciate a ~3x cheaper init.
const nebulaFrag = (fast: boolean) => /* glsl */`
  float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7, 74.7)))*43758.5453123); }
  float noise(vec3 p){
    vec3 i=floor(p), f=fract(p);
    float n000=hash(i+vec3(0,0,0)), n100=hash(i+vec3(1,0,0));
    float n010=hash(i+vec3(0,1,0)), n110=hash(i+vec3(1,1,0));
    float n001=hash(i+vec3(0,0,1)), n101=hash(i+vec3(1,0,1));
    float n011=hash(i+vec3(0,1,1)), n111=hash(i+vec3(1,1,1));
    vec3 u=f*f*(3.0-2.0*f);
    return mix(mix(mix(n000,n100,u.x), mix(n010,n110,u.x), u.y),
               mix(mix(n001,n101,u.x), mix(n011,n111,u.x), u.y), u.z);
  }
  float fbm(vec3 p){
    float a=0.5, s=0.0;
    for(int i=0;i<${fast ? 3 : 5};i++){ s+=a*noise(p); p*=2.02; a*=0.5; }
    return s;
  }
  float worley(vec3 p){
    vec3 i=floor(p), f=fract(p);
    float d=1.0;
    for(int xo=-1; xo<=1; xo++)
    for(int yo=-1; yo<=1; yo++)
    for(int zo=-1; zo<=1; zo++){
      vec3 g=vec3(float(xo),float(yo),float(zo));
      vec3 o=vec3(hash(i+g+0.17), hash(i+g+3.13), hash(i+g+7.31));
      vec3 r=g+o-f;
      d=min(d, dot(r,r));
    }
    return sqrt(d);
  }

  varying vec3 vDir;
  uniform float uTime, uIntensity, uScale, uWarp, uDetail, uSharp;
  uniform vec3  uColorLo;
  uniform vec3  uColors[4];
  uniform vec3  uAccent;
  uniform vec3  uAccent2;
  uniform float uAccentStrength;
  uniform vec3  uBandDir;
  uniform float uBandWidth, uBandSharp, uBandBoost;

  vec3 blend4(float t){
    t = clamp(t, 0.0, 1.0);
    if (t < 0.3333) {
      float k = t / 0.3333;
      return mix(uColors[0], uColors[1], smoothstep(0.0,1.0,k));
    } else if (t < 0.6666) {
      float k = (t - 0.3333) / 0.3333;
      return mix(uColors[1], uColors[2], smoothstep(0.0,1.0,k));
    } else {
      float k = (t - 0.6666) / 0.3334;
      return mix(uColors[2], uColors[3], smoothstep(0.0,1.0,k));
    }
  }

  void main(){
    vec3 p = vDir * uScale;

    vec3 wp = p + uWarp * vec3(
      fbm(p*2.1 + vec3( 1.7,  0.3,  4.1) + uTime*0.08),
      fbm(p*2.0 + vec3(-3.1,  2.7, -0.9) + uTime*0.07),
      fbm(p*2.3 + vec3( 6.5, -1.9,  2.3) + uTime*0.06)
    );

    float cells  = 1.0 - clamp(worley(wp*1.4), 0.0, 1.0);
    ${fast
      ? /* glsl */'float cloud = cells;'
      : /* glsl */`float cells2 = 1.0 - clamp(worley(wp*2.7 + 10.0), 0.0, 1.0);
    float cloud  = mix(cells, max(cells, cells2), 0.6);`}
    cloud = pow(smoothstep(0.25, 0.95, cloud), uSharp);

    float ridged = 1.0 - abs(2.0*fbm(wp*4.0 + uTime*0.02) - 1.0);
    ridged = smoothstep(0.6, 1.0, ridged);

    float mask = clamp(cloud + ridged * uDetail * 0.5, 0.0, 1.0);

    float bandCoord = 1.0 - abs(dot(normalize(vDir), normalize(uBandDir)));
    float band = smoothstep(0.5 - uBandWidth, 0.5 + uBandWidth, bandCoord);
    band = pow(band, uBandSharp);

    float bandEmph = pow(band, 1.5);
    float density = mask * mix(0.25, 1.0, bandEmph);

    float spaceIn  = smoothstep(0.04, 0.50, density);
    float spaceOut = smoothstep(0.12, 0.70, density);
    float space    = mix(spaceOut, spaceIn, bandEmph);
    float tNeb  = space * density;
    float tBand = space * clamp(density*0.40 + band*0.60, 0.0, 1.0);

    vec3 nebCol  = blend4(tNeb);
    vec3 bandCol = blend4(tBand);
    vec3 col = mix(nebCol, bandCol, band * uBandBoost);
    col *= mix(0.7, 1.0, bandEmph);
    float accentMask = pow(band, 3.0) * smoothstep(0.7, 1.0, mask);
    float accentMask2 = pow(band, 2.5) * smoothstep(0.6, 0.9, mask);

    col = mix(col, uAccent, accentMask * uAccentStrength);
    col = mix(col, uAccent2, accentMask2 * uAccentStrength * 0.7);

    col = mix(uColorLo, col, max(space, 0.2));

    float pop = smoothstep(0.85, 1.0, mask);
    col = mix(col, col * 1.12, pop);

    col = mix(uColorLo, col, uIntensity);
    gl_FragColor = vec4(col, 1.0);
  }
`

export interface BakedNebula {
  texture: Texture
  /** The palette's base hue, shared with planets for a cohesive scene */
  baseHue: number
  dispose: () => void
}

export interface NebulaOpts {
  /** Fixed base hue in degrees; null/undefined = random 180-340 like V1 */
  hue?: number | null
  intensity?: number
  /** Cheaper bake shader (fewer octaves, single worley) for weak GPUs */
  fast?: boolean
}

/** Pre-rendered sky for weak GPUs: loads static cube faces from /sky/<name>/
    — the cloud shader never runs on the device at all. */
export function loadStaticNebula(name: string, baseHue: number): BakedNebula {
  const base = `/sky/${name}/`
  const texture = new CubeTextureLoader().load(
    ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map(f => `${base}${f}.webp`)
  )
  return {
    texture,
    baseHue,
    dispose: () => texture.dispose()
  }
}

/** Dev-only: bake the nebula into a byte cube target and return the six faces
    as webp data-URLs — used once to generate the static /sky assets. */
export function exportNebulaFaces(renderer: WebGLRenderer, faceSize: number, opts?: NebulaOpts): string[] {
  const baked = bakeNebulaTarget(renderer, faceSize, opts, false)
  const urls: string[] = []
  const buf = new Uint8Array(faceSize * faceSize * 4)
  const canvas = document.createElement('canvas')
  canvas.width = faceSize
  canvas.height = faceSize
  const ctx = canvas.getContext('2d')!
  for (let face = 0; face < 6; face++) {
    renderer.readRenderTargetPixels(baked.target, 0, 0, faceSize, faceSize, buf, face)
    const img = ctx.createImageData(faceSize, faceSize)
    // readPixels is bottom-up; flip rows into image orientation
    for (let y = 0; y < faceSize; y++) {
      const src = (faceSize - 1 - y) * faceSize * 4
      img.data.set(buf.subarray(src, src + faceSize * 4), y * faceSize * 4)
    }
    ctx.putImageData(img, 0, 0)
    urls.push(canvas.toDataURL('image/webp', 0.92))
  }
  baked.dispose()
  return urls
}

function bakeNebulaTarget(
  renderer: WebGLRenderer,
  faceSize: number,
  opts: NebulaOpts | undefined,
  halfFloat: boolean
) {
  const baseHue = opts?.hue ?? rand(180, 340)
  const { colors, accent, accent2 } = makePalette(baseHue)

  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      // Random fixed time: each load still gets a unique nebula shape
      uTime: { value: rand(0, 1000) },
      uIntensity: { value: opts?.intensity ?? 0.60 },
      uScale: { value: 1.2 },
      uWarp: { value: 0.55 },
      uDetail: { value: 0.45 },
      uSharp: { value: 1.4 },
      uBandDir: { value: new Vector3(0, 1, 0) },
      uBandWidth: { value: 0.35 },
      uBandSharp: { value: 2.5 },
      uBandBoost: { value: 0.7 },
      uColorLo: { value: new Color('#070a14') },
      uColors: { value: colors },
      uAccent: { value: accent },
      uAccent2: { value: accent2 },
      uAccentStrength: { value: 0.25 }
    },
    vertexShader: NEBULA_VERT,
    fragmentShader: nebulaFrag(opts?.fast ?? false)
  })
  // The hash-noise needs full float precision even when the renderer runs
  // mediump (old mobile GPUs) — otherwise the clouds band or break up
  mat.precision = 'highp'

  // Bake: render the shader dome once into a cubemap
  const bakeScene = new Scene()
  const geo = new BoxGeometry(10, 10, 10)
  const dome = new Mesh(geo, mat)
  bakeScene.add(dome)

  const cubeTarget = new WebGLCubeRenderTarget(
    faceSize,
    halfFloat ? { type: HalfFloatType } : undefined
  )
  const cubeCamera = new CubeCamera(0.1, 100, cubeTarget)
  cubeCamera.update(renderer, bakeScene)

  // The shader + dome are no longer needed — only the baked texture lives on
  geo.dispose()
  mat.dispose()

  return {
    target: cubeTarget,
    texture: cubeTarget.texture,
    baseHue,
    dispose: () => cubeTarget.dispose()
  }
}

export function bakeNebula(renderer: WebGLRenderer, faceSize: number, opts?: NebulaOpts): BakedNebula {
  const baked = bakeNebulaTarget(renderer, faceSize, opts, true)
  return { texture: baked.texture, baseHue: baked.baseHue, dispose: baked.dispose }
}
