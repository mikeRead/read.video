// V2 scene orchestrator. Draw calls: ~1 (stars) + 1 (dust) + ~20 (planets/
// rings/moons) + 0-4 (shooting stars) + skybox + 2 post passes ≈ 30,
// vs ~25,000 in V1. Full disposal on teardown, RAF cancelled, pauses when
// the tab is hidden.
import {
  HalfFloatType,
  LinearFilter,
  PerspectiveCamera,
  RGBAFormat,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  WebGLRenderTarget
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { getTier } from './tier'
import { getStyle } from './styles'
import { bakeNebula, exportNebulaFaces, loadStaticNebula } from './nebula'
import { createStarfield } from './starfield'
import { createPlanets } from './planets'
import { createShootingStars } from './shootingStars'
import { createCRTPass } from './CRTPass'

export interface V2Scene {
  renderer: WebGLRenderer
  /** Live state snapshot for perf/behavior verification (no logging) */
  getDebug: () => Record<string, unknown>
  dispose: () => void
}

export function createV2Scene(mount: HTMLElement): V2Scene {
  const tier = getTier()
  const style = getStyle()

  // --- Renderer ---
  const renderer = new WebGLRenderer({
    // MSAA on the default framebuffer is wasted when the composer renders
    // offscreen; AA comes from the render target's `samples` below
    antialias: false,
    powerPreference: tier.mobile ? 'default' : 'high-performance',
    logarithmicDepthBuffer: false, // preserves early-Z; V1 disabled it for everyone
    stencil: false,
    depth: true,
    alpha: false,
    precision: tier.precision
  })
  renderer.outputColorSpace = SRGBColorSpace
  const applySize = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier.dprCap))
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  applySize()
  mount.appendChild(renderer.domElement)

  // --- Scene & camera ---
  const scene = new Scene()
  const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 50000)

  // No lights, no shadow maps: every material is unlit (V1 configured
  // PCFSoft shadows + two lights that could not affect a single material)

  // --- World ---
  // Phones on the default (vapor) style get a PRE-RENDERED sky: static webp
  // cube faces shipped with the site — the cloud shader never runs on-device.
  // Desktop (and non-default styles) bake live, keeping per-load variation.
  const nebula = tier.mobile && style.name === 'vapor'
    ? loadStaticNebula('vapor', style.nebula.hue ?? 290)
    : bakeNebula(renderer, tier.nebulaFaceSize, { ...style.nebula, fast: tier.mobile })
  scene.background = nebula.texture

  // Dev tool: ?exportSky=1 exposes a hook that renders the sky faces to webp
  // data-URLs (used once to generate the shipped /sky assets)
  if (new URLSearchParams(window.location.search).get('exportSky') === '1') {
    ;(window as unknown as Record<string, unknown>).__EXPORT_SKY = (size: number) =>
      exportNebulaFaces(renderer, size, style.nebula)
  }

  const starfield = createStarfield(tier.starCount, tier.dustCount, style.stars)
  scene.add(starfield.points)
  scene.add(starfield.dust)

  const planets = createPlanets(tier.planetCount, tier.sphereSegments, nebula.baseHue, style.planets)
  scene.add(planets.group)

  const shootingStars = createShootingStars()
  scene.add(shootingStars.group)

  // --- Post: render + one combined CRT pass (no depth texture, no identity pass) ---
  const renderTarget = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    samples: tier.msaaSamples
  })
  const composer = new EffectComposer(renderer, renderTarget)
  const renderPass = new RenderPass(scene, camera)
  composer.addPass(renderPass)
  const crt = createCRTPass({ mobile: tier.mobile, baseChroma: style.post.baseChroma })
  composer.addPass(crt.pass)

  // --- Camera controls (V1 feel: drag to steer, wheel to zoom, idle drift) ---
  let isPointerDown = false
  let lastX = 0
  let lastY = 0
  let deltaX = 0
  let deltaY = 0
  let cameraDistance = 1000
  let targetCameraDistance = 1000
  let isUserControlling = false
  let isCompletingMovement = false
  let targetRotX = 0
  let targetRotY = 0
  let userSpeedX = 0
  let userSpeedY = 0
  let hasUserDirection = false
  const easing = 0.05

  // Idle drift (per-second rates; V1's per-frame values × 60)
  const driftX = ((Math.random() - 0.5) / 2000) * 60
  const driftY = ((Math.random() - 0.5) / 2000) * 60
  let posVelX = (Math.random() - 0.5) * 60
  let posVelY = (Math.random() - 0.5) * 60
  let posVelZ = (Math.random() - 0.5) * 60

  const clampPitch = (v: number) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, v))

  // Pure space scene: planets, nebula, stars, drift + user controls.
  // (The planet-dive tour was removed — too fiddly to get seamless.)
  const pointerDown = (x: number, y: number) => {
    isPointerDown = true
    lastX = x
    lastY = y
    isUserControlling = true
    targetRotX = camera.rotation.x
    targetRotY = camera.rotation.y
  }
  const pointerMove = (x: number, y: number) => {
    if (!isPointerDown) return
    deltaX = x - lastX
    deltaY = y - lastY
    targetRotY += deltaX * 0.0005
    targetRotX = clampPitch(targetRotX + deltaY * 0.0005)
    userSpeedX = (deltaY > 0 ? 1 : -1) * Math.abs(driftX)
    userSpeedY = (deltaX > 0 ? 1 : -1) * Math.abs(driftY)
    hasUserDirection = true
    lastX = x
    lastY = y
  }
  const pointerUp = () => {
    if (!isPointerDown) return
    isPointerDown = false
    isUserControlling = false
    isCompletingMovement = true
  }

  const onMouseDown = (e: MouseEvent) => pointerDown(e.clientX, e.clientY)
  const onMouseMove = (e: MouseEvent) => pointerMove(e.clientX, e.clientY)
  const onMouseUp = () => pointerUp()
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) pointerDown(e.touches[0].clientX, e.touches[0].clientY)
  }
  const onTouchMove = (e: TouchEvent) => {
    if (!isPointerDown || e.touches.length !== 1) return
    e.preventDefault()
    pointerMove(e.touches[0].clientX, e.touches[0].clientY)
  }
  const onTouchEnd = () => pointerUp()
  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    targetCameraDistance = Math.max(100, Math.min(5000, targetCameraDistance + e.deltaY * 0.5))
  }

  const canvas = renderer.domElement
  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('touchstart', onTouchStart, { passive: true })
  canvas.addEventListener('touchmove', onTouchMove, { passive: false })
  canvas.addEventListener('touchend', onTouchEnd)

  // --- Resize (also re-applies pixel ratio for cross-display moves) ---
  const onResize = () => {
    applySize()
    renderTarget.setSize(window.innerWidth, window.innerHeight)
    composer.setSize(window.innerWidth, window.innerHeight)
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  }
  window.addEventListener('resize', onResize)

  // --- Context loss (no recovery in V1 either; just surface it) ---
  const onContextLost = (e: Event) => {
    e.preventDefault()
    console.warn('WebGL context lost')
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  // --- Loop (real delta time, paused while tab is hidden) ---
  let rafId = 0
  let lastNow = performance.now()

  const animate = () => {
    rafId = requestAnimationFrame(animate)
    const now = performance.now()
    // Clamp dt so a background-tab return doesn't teleport everything
    const dt = Math.min((now - lastNow) / 1000, 0.1)
    lastNow = now
    const nowSec = now * 0.001

    starfield.update(nowSec)
    planets.update(dt)
    shootingStars.update(dt, now)
    crt.update(now)

    // Dust follows the camera for parallax
    starfield.dust.position.copy(camera.position)

    // Camera drift + steering
    camera.position.x += posVelX * dt
    camera.position.y += posVelY * dt
    camera.position.z += posVelZ * dt

    if (!isUserControlling && !isCompletingMovement) {
      if (hasUserDirection) {
        camera.rotation.x += userSpeedX * dt
        camera.rotation.y += userSpeedY * dt
      } else {
        camera.rotation.x += driftX * dt
        camera.rotation.y += driftY * dt
      }
      targetRotX = camera.rotation.x
      targetRotY = camera.rotation.y
    } else if (isUserControlling) {
      camera.rotation.x += (targetRotX - camera.rotation.x) * easing
      camera.rotation.y += (targetRotY - camera.rotation.y) * easing
    } else {
      // Completing movement: ease to target, then resume drift
      const dX = targetRotX - camera.rotation.x
      const dY = targetRotY - camera.rotation.y
      camera.rotation.x += Math.abs(dX) > 0.001 ? dX * easing : userSpeedX * dt
      camera.rotation.y += Math.abs(dY) > 0.001 ? dY * easing : userSpeedY * dt
      if (Math.abs(dX) < 0.001 && Math.abs(dY) < 0.001) isCompletingMovement = false
    }
    camera.rotation.x = clampPitch(camera.rotation.x)

    // Keep the drift bounded — flip only when heading outward, so a dive exit
    // far from the origin gently drifts back instead of jittering
    if (Math.abs(camera.position.x) > 3000 && Math.sign(posVelX) === Math.sign(camera.position.x)) posVelX *= -1
    if (Math.abs(camera.position.y) > 3000 && Math.sign(posVelY) === Math.sign(camera.position.y)) posVelY *= -1
    if (Math.abs(camera.position.z) > 3000 && Math.sign(posVelZ) === Math.sign(camera.position.z)) posVelZ *= -1

    // Wheel zoom easing
    cameraDistance += (targetCameraDistance - cameraDistance) * 0.05
    camera.position.z = cameraDistance

    composer.render()
  }

  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId)
    } else {
      lastNow = performance.now()
      rafId = requestAnimationFrame(animate)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  rafId = requestAnimationFrame(animate)

  // --- Teardown ---
  const dispose = () => {
    cancelAnimationFrame(rafId)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('resize', onResize)
    canvas.removeEventListener('mousedown', onMouseDown)
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('mouseup', onMouseUp)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('touchstart', onTouchStart)
    canvas.removeEventListener('touchmove', onTouchMove)
    canvas.removeEventListener('touchend', onTouchEnd)
    canvas.removeEventListener('webglcontextlost', onContextLost)

    starfield.dispose()
    planets.dispose()
    shootingStars.dispose()
    nebula.dispose()
    crt.dispose()
    renderTarget.dispose()
    composer.dispose()

    if (canvas.parentElement === mount) mount.removeChild(canvas)
    renderer.dispose()
  }

  const getDebug = () => ({
    pos: camera.position.toArray().map(v => Math.round(v)),
    rot: [camera.rotation.x, camera.rotation.y, camera.rotation.z].map(v => Math.round(v * 100) / 100)
  })

  return { renderer, getDebug, dispose }
}
