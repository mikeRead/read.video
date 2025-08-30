'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { FilmGrainPass } from './FilmGrainPass'

export default function HomePage() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return

    // Set up the threejs scene
    const scene = new THREE.Scene()




    // Add lighting for realistic Earth rendering
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3)  // Subtle ambient light
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)  // Sunlight
    directionalLight.position.set(1000, 500, 1000)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    // Nebula system removed - back to clean space scene

    // Set up the camera with optimized clipping planes to improve depth precision
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 50000)
    camera.updateProjectionMatrix()

    // --- Color palette helpers ---
    const rand = (a: number = 0, b: number = 1) => a + Math.random() * (b - a)
    function hsl(h: number, s: number, l: number) {
      const c = new THREE.Color()
      c.setHSL((((h % 360) + 360) % 360) / 360, s, l)
      return c
    }

    // Helper: always-return bright, colorful hex for planets/rings
    const brightColorHex = () => {
      const c = new THREE.Color()
      c.setHSL(Math.random(), 0.9, 0.65)
      return c.getHex()
    }

    // Two similar colors for cleaner look (darker, subtle shift)
    function makeSimplePalette(baseHue: number) {
      // Slightly increase variance: wider hue offset and tiny sat/light jitter
      const s0 = 0.50 + rand(-0.04, 0.04)
      const s1 = 0.50 + rand(-0.06, 0.06)
      const l0 = 0.18 + rand(-0.02, 0.02)
      const l1 = 0.14 + rand(-0.02, 0.02)
      const c0 = hsl(baseHue, s0, l0)
      const c1 = hsl(baseHue + rand(-28, 28), s1, l1)
      return [c0, c1, c1, c0]
    }

    function makeAccent(baseHue: number) {
      const hue = baseHue + (Math.random() < 0.5 ? 60 : -60)
      return hsl(hue, 0.65, 0.30) // subtle, slightly brighter accent
    }

    const baseHue = rand(180, 340)
    const palette = makeSimplePalette(baseHue)
    const accent = makeAccent(baseHue)

    // Create realistic nebula background using advanced procedural shader (multi-color + galactic band)
    const nebulaMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.60 },
        uScale: { value: 1.2 },
        uWarp: { value: 0.55 },
        uDetail: { value: 0.45 },
        uSharp: { value: 1.4 },
        // Band controls
        uBandDir: { value: new THREE.Vector3(0, 1, 0).normalize() },
        uBandWidth: { value: 0.35 },
        uBandSharp: { value: 2.5 },
        uBandBoost: { value: 0.7 },
        // Space tint + palette
        uColorLo: { value: new THREE.Color('#070a14') },
        uColors: { value: palette },
        uAccent: { value: new THREE.Color(accent) },
        uAccentStrength: { value: 0.12 },
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){
          vec4 w = modelMatrix * vec4(position,1.0);
          vDir = normalize(w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */`
        // ---------- noise utils ----------
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
          for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.02; a*=0.5; }
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
        uniform float uAccentStrength;
        uniform vec3  uBandDir;
        uniform float uBandWidth, uBandSharp, uBandBoost;

        // Smooth 4-color blending (restored)
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
          float cells2 = 1.0 - clamp(worley(wp*2.7 + 10.0), 0.0, 1.0);
          float cloud  = mix(cells, max(cells, cells2), 0.6);
          cloud = pow(smoothstep(0.25, 0.95, cloud), uSharp);

          float ridged = 1.0 - abs(2.0*fbm(wp*4.0 + uTime*0.02) - 1.0);
          ridged = smoothstep(0.6, 1.0, ridged);

          float mask = clamp(cloud + ridged * uDetail * 0.5, 0.0, 1.0);

          // Galactic band (horizon)
          float bandCoord = 1.0 - abs(dot(normalize(vDir), normalize(uBandDir)));
          float band = smoothstep(0.5 - uBandWidth, 0.5 + uBandWidth, bandCoord);
          band = pow(band, uBandSharp);

          // Emphasize density along the band to feel like a horizon
          float bandEmph = pow(band, 1.5);
          float density = mask * mix(0.25, 1.0, bandEmph);

          // Gate with "space" so we get black in between clouds
          // Softer inside band, more empty outside
          float spaceIn  = smoothstep(0.04, 0.50, density);
          float spaceOut = smoothstep(0.12, 0.70, density);
          float space    = mix(spaceOut, spaceIn, bandEmph);
          float tNeb  = space * density;
          float tBand = space * clamp(density*0.40 + band*0.60, 0.0, 1.0);

          vec3 nebCol  = blend4(tNeb);
          vec3 bandCol = blend4(tBand);
          // Emphasize the band, dim outside regions slightly
          vec3 col = mix(nebCol, bandCol, band * uBandBoost);
          col *= mix(0.7, 1.0, bandEmph);
          // Add faint accent only near the band peaks
          float accentMask = pow(band, 3.0) * smoothstep(0.7, 1.0, mask);
          col = mix(col, uAccent, accentMask * uAccentStrength);
          
          // Blend toward deep space based on inverse space to keep gaps
          col = mix(uColorLo, col, max(space, 0.2));

          float pop = smoothstep(0.85, 1.0, mask);
          col = mix(col, col * 1.12, pop);

          col = mix(uColorLo, col, uIntensity);
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });

    // Create and add the sky dome; no non-uniform scaling
    const sphereGeometry = new THREE.SphereGeometry(35000, 96, 96);
    const nebula = new THREE.Mesh(sphereGeometry, nebulaMat);
    // Align band to initial camera up (horizon reference)
    nebulaMat.uniforms.uBandDir.value.copy(new THREE.Vector3(0, 1, 0).applyEuler(camera.rotation)).normalize();
    scene.add(nebula);





    // Set up the renderer with enhanced anti-aliasing and depth buffer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: true,  // Dramatically improves depth precision
      stencil: false,
      depth: true,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false
    })

    // Enable MSAA (Multi-Sample Anti-Aliasing) for better quality and reduce banding
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = false
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setSize(window.innerWidth, window.innerHeight)
    mountRef.current.appendChild(renderer.domElement)

    // Create color enhancement shader
    const colorEnhancementShader = {
      uniforms: {
        tDiffuse: { value: 1 },
        saturation: { value: 1.0 },
        contrast: { value: 1.0 },
        brightness: { value: 1.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float saturation;
        uniform float contrast;
        uniform float brightness;
        varying vec2 vUv;
        
        vec3 adjustSaturation(vec3 color, float saturation) {
          float luminance = dot(color, vec3(0.299, 0.587, 0.114));
          return mix(vec3(luminance), color, saturation);
        }
        
        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec3 color = texel.rgb;
          
          // Apply saturation
          color = adjustSaturation(color, saturation);
          
          // Apply contrast
          color = (color - 0.5) * contrast + 0.5;
          
          // Apply brightness
          color *= brightness;
          
          gl_FragColor = vec4(color, texel.a);
        }
      `
    }

    // Create high-precision render target to reduce banding
    const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: 4
    })
    renderTarget.depthTexture = new THREE.DepthTexture(window.innerWidth, window.innerHeight, THREE.UnsignedShortType)

    // Create post-processing effect with custom target
    const effectComposer = new EffectComposer(renderer, renderTarget)
    const renderPass = new RenderPass(scene, camera)
    effectComposer.addPass(renderPass)

    const colorPass = new ShaderPass(colorEnhancementShader)
    effectComposer.addPass(colorPass)

    // Create animated chroma function that intensifies during glitches
    let isGlitchActive = false
    let glitchStartTime = 0
    let glitchDuration = 0

    const getAnimatedChroma = () => {
      if (!isGlitchActive) return 0.0055 // Normal chroma

      const elapsed = performance.now() - glitchStartTime
      const progress = elapsed / glitchDuration

      // Create pulsing chroma effect during glitch
      const pulse = Math.sin(progress * Math.PI * 8) * 0.5 + 0.5 // 8 pulses over glitch duration
      const intensity = THREE.MathUtils.lerp(0.01, 0.02, pulse) // Range: 0.008 to 0.025

      return intensity
    }

    const filmPass = FilmGrainPass({
      noiseIntensity: () => THREE.MathUtils.lerp(0.04, 0.08, Math.random()),
      scanlineIntensity: () => 0,
      scanlineCount: () => 720.0,
      vignette: () => .5,
      chroma: getAnimatedChroma,
      jitter: () => 0,
      glitchStrength: () => THREE.MathUtils.lerp(0.008, 0.02, Math.random()),
      glitchBandHeight: () => THREE.MathUtils.lerp(0.015, 0.06, Math.random()),
      glitchScrollSpeed: () => THREE.MathUtils.lerp(0.7, 1.1, Math.random()),
      getGlitchIntervalSeconds: () => THREE.MathUtils.randFloat(1.0, 5.0),
      getGlitchDurationSeconds: () => THREE.MathUtils.randFloat(.5, .6)
    })
      ; (filmPass as { renderToScreen?: boolean }).renderToScreen = true
    effectComposer.addPass(filmPass)











    // Create an array to hold our stars (original system)
    const stars: THREE.Vector3[] = []

    // Create a loop to generate random stars (original: 25000 stars)
    for (let i = 0; i < 25000; i++) {
      const star = new THREE.Vector3()
      star.x = THREE.MathUtils.randFloatSpread(50000)
      star.y = THREE.MathUtils.randFloatSpread(20000)
      star.z = THREE.MathUtils.randFloatSpread(50000)
      stars.push(star)
    }

    // Star sprite texture (soft glow with stronger cross arms) for nearby stars
    function generateStarTexture(size = 128): THREE.Texture {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!

      // Radial glow
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

      // Cross arms: horizontal, vertical, and diagonals
      ctx.globalCompositeOperation = 'lighter'
      const armGradH = ctx.createLinearGradient(0, cy, size, cy)
      armGradH.addColorStop(0.0, 'rgba(255,255,255,0.0)')
      armGradH.addColorStop(0.5, 'rgba(255,255,255,0.6)')
      armGradH.addColorStop(1.0, 'rgba(255,255,255,0.0)')
      ctx.fillStyle = armGradH
      ctx.fillRect(0, cy - 2, size, 4)

      const armGradV = ctx.createLinearGradient(cx, 0, cx, size)
      armGradV.addColorStop(0.0, 'rgba(255,255,255,0.0)')
      armGradV.addColorStop(0.5, 'rgba(255,255,255,0.6)')
      armGradV.addColorStop(1.0, 'rgba(255,255,255,0.0)')
      ctx.fillStyle = armGradV
      ctx.fillRect(cx - 2, 0, 4, size)

      // Diagonals ±45°
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(Math.PI / 4)
      ctx.fillStyle = armGradH
      ctx.fillRect(-r, -2, size, 4)
      ctx.rotate(-Math.PI / 2)
      ctx.fillRect(-r, -2, size, 4)
      ctx.restore()

      const texture = new THREE.CanvasTexture(canvas)
      texture.anisotropy = 4
      texture.needsUpdate = true
      return texture
    }

    const starSpriteTexture = generateStarTexture(128)
    const starSpriteMaterial = new THREE.SpriteMaterial({
      map: starSpriteTexture,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })

    // ---------------- Small particles (dust) ----------------
    const particleCount = 4000
    const particleRange = 5000
    const particlePositions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      const ix = i * 3
      particlePositions[ix + 0] = THREE.MathUtils.randFloatSpread(particleRange)
      particlePositions[ix + 1] = THREE.MathUtils.randFloatSpread(particleRange * 0.6)
      particlePositions[ix + 2] = THREE.MathUtils.randFloatSpread(particleRange)
    }
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.12,
      depthWrite: false
    })
    const smallParticles = new THREE.Points(particleGeometry, particleMaterial)
    smallParticles.renderOrder = 1
    scene.add(smallParticles)

    // Removed line-based star material; using opaque points/spheres only



    // Create hybrid star system - cross stars for close stars, points for distant ones
    for (let i = 0; i < stars.length; i++) {
      const distanceFromCamera = Math.sqrt(
        Math.pow(stars[i].x, 2) +
        Math.pow(stars[i].y, 2) +
        Math.pow(stars[i].z, 2)
      )

      // For near stars, create a star-like sprite (soft glow + cross arms)
      if (distanceFromCamera < 5000) {
        const sprite = new THREE.Sprite(starSpriteMaterial.clone())
        sprite.position.copy(stars[i])
        const scale = THREE.MathUtils.randFloat(16, 28)
        sprite.scale.set(scale, scale, 1)
        scene.add(sprite)
      } else {
        // Create simple point for distant stars (better performance)
        const pointGeometry = new THREE.BufferGeometry().setFromPoints([stars[i]])
        const pointMaterial = new THREE.PointsMaterial({
          color: Math.random() < 0.90 ? 0xffffff : Math.random() * 0xffffff,
          size: Math.ceil(Math.random()) * 15 + 5
        })
        const pointStar = new THREE.Points(pointGeometry, pointMaterial)
        scene.add(pointStar)
      }
    }

    // Shooting stars
    interface ShootingStar {
      mesh: THREE.Mesh
      velocity: THREE.Vector3
      life: number
      maxLife: number
    }
    const shootingStars: ShootingStar[] = []
    let lastSpawnTime = 0

    const spawnShootingStar = () => {
      const startDist = THREE.MathUtils.randFloat(6000, 12000)
      const startAngle = Math.random() * Math.PI * 2
      const startHeight = THREE.MathUtils.randFloat(-300, 300)
      const start = new THREE.Vector3(
        Math.cos(startAngle) * startDist,
        startHeight,
        Math.sin(startAngle) * startDist
      )
      const dirAngle = startAngle + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2)
      const direction = new THREE.Vector3(
        Math.cos(dirAngle),
        THREE.MathUtils.randFloat(-0.15, 0.15),
        Math.sin(dirAngle)
      ).normalize()
      // Wider, more varied speed range for randomness
      const speed = THREE.MathUtils.randFloat(900, 15200)
      // Randomize lifetime (seconds) per star for varied durations
      const lifetime = THREE.MathUtils.randFloat(1, 3.0)
      // Use a bright dot (sphere) instead of a streak line
      const geom = new THREE.SphereGeometry(10, 12, 12)
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
      const streak = new THREE.Mesh(geom, mat)
      streak.position.copy(start)
      streak.renderOrder = 3
      scene.add(streak)

      shootingStars.push({
        mesh: streak,
        velocity: direction.multiplyScalar(speed),
        life: lifetime,
        maxLife: lifetime
      })
    }












    // Function to add a random planet with rings
    function addRandomPlanetWithRings() {
      const planetSize = Math.random() * 150 + 50
      const planetGeometry = new THREE.SphereGeometry(planetSize, 32, 32)
      const planetColor = brightColorHex()
      const planetMaterial = new THREE.MeshBasicMaterial({
        color: planetColor
      })
      const planet = new THREE.Mesh(planetGeometry, planetMaterial)
      planet.position.x = THREE.MathUtils.randFloatSpread(20000)
      planet.position.y = THREE.MathUtils.randFloatSpread(3000)
      planet.position.z = THREE.MathUtils.randFloatSpread(20000)
      scene.add(planet)

      const rcolor = brightColorHex()
      const rRotation = Math.random() * Math.PI * 2

      // Add rings
      if (Math.random() < 0.5) {
        const ringGeometry = new THREE.RingGeometry(planetSize * 1.2, planetSize * 1.7, 32)
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: rcolor,
          side: THREE.DoubleSide,
          opacity: 0.6,
          transparent: true,
          depthWrite: false,
          depthTest: true
        })
        const ring = new THREE.Mesh(ringGeometry, ringMaterial)
        ring.position.copy(planet.position)
        ring.rotation.x = rRotation
        scene.add(ring)

        if (Math.random() < 0.5) {
          const ring2Geometry = new THREE.RingGeometry(planetSize * 1.8, planetSize * 1.9, 32)
          const ring2Material = new THREE.MeshBasicMaterial({
            color: planetColor,
            side: THREE.DoubleSide,
            opacity: 0.30,
            transparent: true,
            depthWrite: false,
            depthTest: true
          })
          const ring2 = new THREE.Mesh(ring2Geometry, ring2Material)
          ring2.position.copy(planet.position)
          ring2.rotation.x = rRotation
          scene.add(ring2)
        }
      } else if (Math.random() < 0.5) {
        const moonGeometry = new THREE.SphereGeometry(planetSize / 6, 32, 32)
        const moonMaterial = new THREE.MeshBasicMaterial({ color: Math.random() * 0xffffff })
        const moon = new THREE.Mesh(moonGeometry, moonMaterial)
        moon.position.x = (planet.position.x + ((Math.random() * 100) + 200)) * (Math.random() > 0.5 ? -1 : 1)
        moon.position.y = (planet.position.y + ((Math.random() * 100) + 200)) * (Math.random() > 0.5 ? -1 : 1)
        moon.position.z = (planet.position.z + ((Math.random() * 100) + 200)) * (Math.random() > 0.5 ? -1 : 1)
        moon.rotation.x = rRotation
        scene.add(moon)
      }
    }

    // Create a random planet that always appears in front of the camera
    function createRandomPlanet() {
      const planetSize = Math.random() * 150 + 120  // Slightly larger floor for visibility
      const planetGeometry = new THREE.SphereGeometry(planetSize, 48, 48)

      // Generate random planet color
      const planetColors = [
        0xFF6B6B,  // Bright Red
        0x4ECDC4,  // Bright Teal
        0x45B7D1,  // Bright Blue
        0x96CEB4,  // Bright Green
        0xFFEAA7,  // Bright Yellow
        0xDDA0DD,  // Bright Plum
        0x98D8C8,  // Bright Mint
        0xF7DC6F,  // Bright Gold
        0xBB8FCE,  // Bright Purple
        0x85C1E9,  // Bright Light Blue
        0xFF1493,  // Deep Pink
        0x00CED1,  // Dark Turquoise
        0x32CD32,  // Lime Green
        0xFFD700,  // Gold
        0xFF6347,  // Tomato Red
        0x9370DB,  // Medium Purple
        0x20B2AA,  // Light Sea Green
        0xFF69B4,  // Hot Pink
        0x00BFFF,  // Deep Sky Blue
        0xFF4500,  // Orange Red
        0x8A2BE2,  // Blue Violet
        0x00FF7F,  // Spring Green
        0xFF1493,  // Deep Pink
        0x1E90FF,  // Dodger Blue
        0x32CD32,  // Lime Green
        0xFFD700,  // Gold
        0xFF6347,  // Tomato Red
        0x9370DB,  // Medium Purple
        0x20B2AA,  // Light Sea Green
        0xFF69B4,  // Hot Pink
        0xFF00FF,  // Magenta
        0x00FFFF,  // Cyan
        0xFFFF00,  // Yellow
        0xFF0080,  // Electric Pink
        0x00FF00,  // Electric Green
        0x0080FF,  // Electric Blue
        0xFF8000,  // Electric Orange
        0x8000FF,  // Electric Purple
        0xFF4080,  // Neon Pink
        0x40FF80,  // Neon Green
        0x4080FF,  // Neon Blue
        0xFFFF80,  // Neon Yellow
        0xFF8040,  // Neon Orange
        0x8040FF   // Neon Purple
      ]
      const randomColor = planetColors[Math.floor(Math.random() * planetColors.length)]

      const planetMaterial = new THREE.MeshBasicMaterial({
        color: randomColor
      })

      const planet = new THREE.Mesh(planetGeometry, planetMaterial)

      // Position planet in front of the camera
      planet.position.set(0, 0, -800)
      planet.renderOrder = 2
      scene.add(planet)

      // Randomly add rings (30% chance)
      if (Math.random() < 0.3) {
        const ringGeometry = new THREE.RingGeometry(planetSize * 1.5, planetSize * 2.2, 32)
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: Math.random() * 0xffffff,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
          depthWrite: false,
          depthTest: true
        })
        const ring = new THREE.Mesh(ringGeometry, ringMaterial)
        ring.rotation.x = Math.PI / 2
        ring.position.set(0, 0, 0) // Position relative to planet center
        planet.add(ring)
      }

      // Do not add moons to the foreground planet

      return planet
    }

    // Create the random planet
    const randomPlanet = createRandomPlanet()

    // Add some random planets with rings initially (reduced)
    for (let i = 0; i < 5; i++) {
      addRandomPlanetWithRings()
    }

    // Camera control variables
    let isMouseDown = false
    let mouseX = 0
    let mouseY = 0
    let lastMouseX = 0
    let lastMouseY = 0
    let mouseDeltaX = 0
    let mouseDeltaY = 0
    let cameraDistance = 1000
    let targetCameraDistance = 1000

    // Camera control state - separate from automatic movement
    const userRotationX = camera.rotation.x
    const userRotationY = camera.rotation.y
    let isUserControlling = false
    let isCompletingMovement = false  // Track when we're completing a user movement

    // World-space orientation tracking to prevent gimbal lock issues
    let worldRotationX = 0
    let worldRotationY = 0
    let targetWorldRotationX = 0
    let targetWorldRotationY = 0

    // User-established rotation direction tracking
    let userRotationSpeedX = 0
    let userRotationSpeedY = 0
    let hasUserEstablishedDirection = false

    // Smooth easing variables for camera movement
    const easingFactor = 0.05  // Lower = smoother, slower movement (reduced from 0.08)

    // Random camera movement variables (restored from original)
    const x = (Math.random() - 0.5) / 2000
    const y = (Math.random() - 0.5) / 2000
    const z = (Math.random() - 0.5) / 2000

    let px = (Math.random() - 0.5) / 1
    let py = (Math.random() - 0.5) / 1
    let pz = (Math.random() - 0.5) / 1

    // Mouse event handlers
    const handleMouseDown = (event: MouseEvent) => {
      isMouseDown = true
      lastMouseX = event.clientX
      lastMouseY = event.clientY

      // Start user control session and initialize world rotation
      isUserControlling = true
      worldRotationX = camera.rotation.x
      worldRotationY = camera.rotation.y
      targetWorldRotationX = worldRotationX
      targetWorldRotationY = worldRotationY
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!isMouseDown) return

      mouseX = event.clientX
      mouseY = event.clientY

      mouseDeltaX = mouseX - lastMouseX
      mouseDeltaY = mouseY - lastMouseY

      // Update world rotation targets based on mouse movement (even slower and smoother)
      targetWorldRotationY += mouseDeltaX * 0.0005  // Reduced from 0.0008 for even slower movement
      targetWorldRotationX += mouseDeltaY * 0.0005  // Reduced from 0.0008 for even slower movement

      // Track the rotation direction established by user, but use the same speed as default random rotation
      const directionX = mouseDeltaY > 0 ? 1 : -1
      const directionY = mouseDeltaX > 0 ? 1 : -1
      userRotationSpeedX = directionX * Math.abs(x)  // Use same magnitude as default random rotation
      userRotationSpeedY = directionY * Math.abs(y)  // Use same magnitude as default random rotation
      hasUserEstablishedDirection = true

      // Clamp vertical rotation to prevent flipping
      targetWorldRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetWorldRotationX))

      lastMouseX = mouseX
      lastMouseY = mouseY
    }

    const handleMouseUp = () => {
      isMouseDown = false

      // End user control session but continue easing to final position
      isUserControlling = false
      isCompletingMovement = true
      // Lock post-drift direction to the last input direction at baseline speed
      const baseSpeedX = Math.abs(x)
      const baseSpeedY = Math.abs(y)
      const dirX = mouseDeltaY > 0 ? 1 : (mouseDeltaY < 0 ? -1 : (userRotationSpeedX >= 0 ? 1 : -1))
      const dirY = mouseDeltaX > 0 ? 1 : (mouseDeltaX < 0 ? -1 : (userRotationSpeedY >= 0 ? 1 : -1))
      userRotationSpeedX = dirX * baseSpeedX
      userRotationSpeedY = dirY * baseSpeedY
      hasUserEstablishedDirection = true
    }

    // Touch event handlers for mobile
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        isMouseDown = true
        lastMouseX = event.touches[0].clientX
        lastMouseY = event.touches[0].clientY

        // Start user control session and initialize world rotation
        isUserControlling = true
        worldRotationX = camera.rotation.x
        worldRotationY = camera.rotation.y
        targetWorldRotationX = worldRotationX
        targetWorldRotationY = worldRotationY
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!isMouseDown || event.touches.length !== 1) return
      event.preventDefault()

      const touch = event.touches[0]
      mouseX = touch.clientX
      mouseY = touch.clientY

      mouseDeltaX = mouseX - lastMouseX
      mouseDeltaY = mouseY - lastMouseY

      // Update world rotation targets based on touch movement (even slower and smoother)
      targetWorldRotationY += mouseDeltaX * 0.0005  // Reduced from 0.0008 for even slower movement
      targetWorldRotationX += mouseDeltaY * 0.0005  // Reduced from 0.0008 for even slower movement

      // Track the rotation direction established by user, but use the same speed as default random rotation
      const directionX = mouseDeltaY > 0 ? 1 : -1
      const directionY = mouseDeltaX > 0 ? 1 : -1
      userRotationSpeedX = directionX * Math.abs(x)  // Use same magnitude as default random rotation
      userRotationSpeedY = directionY * Math.abs(y)  // Use same magnitude as default random rotation
      hasUserEstablishedDirection = true

      // Clamp vertical rotation to prevent flipping
      targetWorldRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetWorldRotationX))

      lastMouseX = mouseX
      lastMouseY = mouseY
    }

    const handleTouchEnd = () => {
      isMouseDown = false

      // End user control session but continue easing to final position
      isUserControlling = false
      isCompletingMovement = true
    }



    // Mouse wheel zoom
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()

      // Zoom in/out
      targetCameraDistance += event.deltaY * 0.5
      targetCameraDistance = Math.max(100, Math.min(5000, targetCameraDistance))
    }

    // Add event listeners
    const canvas = renderer.domElement
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('wheel', handleWheel)

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd)



    // Function to animate the camera
    // Glitch scheduling (random 1-5s intervals)
    let nextGlitchAt = performance.now() + THREE.MathUtils.randFloat(1000, 5000)
    let glitchEndAt = 0

    function animate() {
      requestAnimationFrame(animate)

      // Update nebula time uniform for animation
      if (nebulaMat) {
        nebulaMat.uniforms.uTime.value = performance.now() * 0.00005;
      }

      // Drive film grain uniforms for animation and randomized glitches
      const filmUniforms = (filmPass as { uniforms?: Record<string, { value: number }> })?.uniforms
      if (filmUniforms) {
        const nowMs = performance.now()
        filmUniforms.time.value = nowMs * 0.001

        // Live-update uniforms from providers if present
        const providers = (filmPass as { userData?: { providers?: Record<string, () => number> } })?.userData?.providers
        if (providers) {
          if (filmUniforms.noiseIntensity) filmUniforms.noiseIntensity.value = providers.noiseIntensity()
          if (filmUniforms.scanlineIntensity) filmUniforms.scanlineIntensity.value = providers.scanlineIntensity()
          if (filmUniforms.scanlineCount) filmUniforms.scanlineCount.value = providers.scanlineCount()
          if (filmUniforms.vignette) filmUniforms.vignette.value = providers.vignette()
          if (filmUniforms.chroma) filmUniforms.chroma.value = providers.chroma()
          if (filmUniforms.jitter) filmUniforms.jitter.value = providers.jitter()
          if (filmUniforms.glitchStrength) filmUniforms.glitchStrength.value = providers.glitchStrength()
          if (filmUniforms.glitchBandHeight) filmUniforms.glitchBandHeight.value = providers.glitchBandHeight()
          if (filmUniforms.glitchScrollSpeed) filmUniforms.glitchScrollSpeed.value = providers.glitchScrollSpeed()
        }

        if (nowMs >= nextGlitchAt) {
          filmUniforms.glitchActive.value = 1.0
          filmUniforms.glitchSeed.value = Math.random() * 1000.0

          // Update glitch state for chroma animation
          isGlitchActive = true
          glitchStartTime = nowMs

          // Randomize band count 1-5 per burst
          if (filmUniforms.glitchCount) {
            filmUniforms.glitchCount.value = THREE.MathUtils.randInt(1, 5)
          }
          let durationMs = THREE.MathUtils.randFloat(60, 160) // default: 0.06s - 0.16s
          if (providers?.getGlitchDurationMs) {
            durationMs = providers.getGlitchDurationMs()
          } else if (typeof filmUniforms.glitchDuration?.value === 'number' && filmUniforms.glitchDuration.value > 0) {
            durationMs = filmUniforms.glitchDuration.value * 1000.0
          }
          glitchEndAt = nowMs + durationMs
          glitchDuration = durationMs
          nextGlitchAt = nowMs + (providers?.getGlitchIntervalMs ? providers.getGlitchIntervalMs() : THREE.MathUtils.randFloat(1000, 5000))
        }
        if (glitchEndAt && nowMs >= glitchEndAt) {
          filmUniforms.glitchActive.value = 0.0
          glitchEndAt = 0

          // Update glitch state for chroma animation
          isGlitchActive = false
        }
      }

      // Keep nebula centered on camera for infinite distance illusion
      nebula.position.copy(camera.position);

      // Slight parallax drift for small particles
      smallParticles.position.copy(camera.position)



      // Random camera movement (restored from original)
      camera.position.x += px
      camera.position.y += py
      camera.position.z += pz

      // Apply rotation movement based on user input or established direction
      if (!isUserControlling && !isCompletingMovement) {
        if (hasUserEstablishedDirection) {
          // Continue drifting in the established direction at baseline speed (no roll)
          camera.rotation.x += userRotationSpeedX
          camera.rotation.y += userRotationSpeedY
        } else {
          // Use original random rotation until user establishes direction (no roll)
          camera.rotation.x += x
          camera.rotation.y += y
        }

        // Update world rotation to match current camera rotation
        worldRotationX = camera.rotation.x
        worldRotationY = camera.rotation.y
        targetWorldRotationX = worldRotationX
        targetWorldRotationY = worldRotationY
      } else if (isUserControlling) {
        // When user is actively controlling, smoothly ease toward world rotation targets
        camera.rotation.x += (targetWorldRotationX - camera.rotation.x) * easingFactor
        camera.rotation.y += (targetWorldRotationY - camera.rotation.y) * easingFactor
      } else if (isCompletingMovement) {
        // When completing movement, ease toward target but maintain minimum rotation speed
        const deltaX = targetWorldRotationX - camera.rotation.x
        const deltaY = targetWorldRotationY - camera.rotation.y

        // Apply easing but ensure minimum rotation speed in established direction
        if (Math.abs(deltaX) > 0.001) {
          camera.rotation.x += deltaX * easingFactor
        } else {
          // Reached target, continue rotating in established direction at default speed
          camera.rotation.x += userRotationSpeedX
        }

        if (Math.abs(deltaY) > 0.001) {
          camera.rotation.y += deltaY * easingFactor
        } else {
          // Reached target, continue rotating in established direction at default speed
          camera.rotation.y += userRotationSpeedY
        }

        // Clamp vertical rotation to prevent flipping while drifting
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x))

        // Check if we've reached the target (within a small threshold)
        if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
          isCompletingMovement = false  // Stop completing movement
        }
      }

      // Always clamp vertical rotation outside control branches as well
      camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x))

      // Don't have the camera drift too far away
      if (Math.abs(camera.position.x) > 3000) {
        px = px * -1
      }
      if (Math.abs(camera.position.y) > 3000) {
        py = py * -1
      }
      if (Math.abs(camera.position.z) > 3000) {
        pz = pz * -1
      }

      // Smooth camera distance interpolation for zoom
      cameraDistance += (targetCameraDistance - cameraDistance) * 0.05  // Match rotation easing
      camera.position.z = cameraDistance

      // Shooting star spawn/update
      const now = performance.now()
      // More irregular spawn cadence
      if (now - lastSpawnTime > THREE.MathUtils.randInt(1200, 8200)) {
        spawnShootingStar()
        lastSpawnTime = now
      }
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i]
        const dt = 1 / 60 // approx frame time
        s.mesh.position.addScaledVector(s.velocity, dt)
        // Fade proportionally to remaining life
        s.life -= dt
          ; (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life / s.maxLife)
        if (s.life <= 0) {
          scene.remove(s.mesh)
          shootingStars.splice(i, 1)
        }
      }

      effectComposer.render()
    }

    // Initialize depth uniforms and bind depth texture to film pass
    const filmUniformsInit = (filmPass as { uniforms?: Record<string, { value: number }> })?.uniforms
    if (filmUniformsInit) {
      // Depth uniforms removed - using simple chroma now
    }

    animate()

    // Resize the canvas when the window is resized
    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      renderer.setSize(width, height)
      renderTarget.setSize(width, height)
      if (renderTarget.depthTexture) {
        renderTarget.depthTexture.image.width = width
        renderTarget.depthTexture.image.height = height
      }
      effectComposer.setSize(width, height)
      // Update depth uniforms used by film pass
      const filmUniforms = (filmPass as { uniforms?: Record<string, { value: number }> })?.uniforms
      if (filmUniforms) {
        // Depth uniforms removed - using simple chroma now
      }

      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      // Remove event listeners
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)



      window.removeEventListener('resize', handleResize)

      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  useEffect(() => {
    // HTML Text Animations
    const h2Element = document.getElementsByTagName("h2")[0]
    const subtitle = ['Mike', '@', 'Read', '.', 'video'].join('')

    // A function to "type" out text to the passed DOM element
    const type = (el: HTMLElement, text: string, endText?: string, i = 0) => {
      let typingSpeed = Math.floor(Math.random() * 50) + 50
      // Add some extra delay to make it seem more humanly typed
      const nextChar = text.charAt(i + 1)
      if (nextChar === '@') {
        typingSpeed = 300
      }
      if (nextChar === 'R') {
        typingSpeed = 300
      }
      if (nextChar === '.') {
        typingSpeed = 200
      }
      if (i < text.length) {
        el.innerHTML += text.charAt(i)
        i++
        setTimeout(() => type(el, text, endText, i), typingSpeed)
      } else if (endText) {
        el.innerHTML = endText
      }
    }

    let clickTimeout: NodeJS.Timeout

    // When a user clicks the email address
    const handleEmailClick = () => {
      clearTimeout(clickTimeout)
      navigator.clipboard.writeText(subtitle)
      h2Element.textContent = "EMAIL Copied to Clipboard!"

      clickTimeout = setTimeout(() => {
        const messages = [
          "I can't wait to have a chat!",
          "Look'n forward to hearing from ya!",
          "Don't be a stranger :D",
          "I'd love to hear from you!",
          "Let's keep in touch!",
          "Can't wait to hear your thoughts!",
          "Chat with you soon!",
          "Let's chat soon!",
          "Keep me posted on your adventures!",
          "Take care and let's speak soon!",
          "You're awesome—thanks for reaching out!",
          "Ping me anytime, I'm around!",
          "So excited to connect with you!",
          "Appreciate you—talk soon!",
          "This is going to be fun—let's chat!",
          "Can't wait—this will be great!",
          "You're the best—talk soon!",
        ]
        h2Element.textContent = messages[Math.floor(Math.random() * messages.length)]

        clickTimeout = setTimeout(() => {
          h2Element.textContent = subtitle
        }, 4000)
      }, 2000)
    }

    if (h2Element) {
      h2Element.addEventListener('click', handleEmailClick)
    }

    // Read.Vide[3,2,1,O] Countdown
    let time = 3
    const countdown = setInterval(() => {
      time--
      const countdownElement = document.getElementById('countdown')
      const blinkElement = document.getElementById('blink')
      const canvas = document.getElementsByTagName('canvas')[0]

      if (time === 0) {
        // Put the "O" in Video
        if (countdownElement) {
          countdownElement.innerHTML = 'O'
          countdownElement.classList.remove("countdown-padding")
        }
        // Fade in the three.js canvas
        if (canvas) {
          canvas.classList.add("fade-in-canvas")
        }
        // Have the period in READ.VIDEO blink red
        if (blinkElement) {
          blinkElement.classList.add("blink")
        }
        // Start film grain fade-in
        const grainElement = document.querySelector('.film-grain') as HTMLElement
        if (grainElement) {
          grainElement.style.opacity = '0.15'
        }
        // Wait a second and start "typing" out the subtitle/email
        setTimeout(() => {
          if (h2Element) {
            type(h2Element, subtitle)
          }
        }, 1000)
        clearInterval(countdown)
      } else if (time <= 3) {
        // Show the numbers going down to O
        if (countdownElement) {
          countdownElement.textContent = time.toString()
        }
      }
    }, 1000)

    return () => {
      if (h2Element) {
        h2Element.removeEventListener('click', handleEmailClick)
      }
      clearInterval(countdown)
      clearTimeout(clickTimeout)
    }
  }, [])

  return (
    <>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        html, body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          font-family: sans-serif;
          background-color: black;
          color: white;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }
        
        canvas {
          display: block;
          opacity: 0;
        }
        
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        
        .fade-in-canvas { 
          animation: fadeIn 2s; 
          opacity: 1;
        }
        
        .header {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          color: white;
          z-index: 100;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          pointer-events: none;
        }
        
        .header h1 {
          font-size: 3em;
          margin: 0;
        }
        
        .header h2 {
          font-size: 1em;
          margin: 0;
          height: 30px;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 200;
        }
        
        @keyframes blink {
          0% { color: #1a1a1a; }
          50% { color: red; }
          100% { color: #1a1a1a; }
        }
        
        .blink {
          color: red;
          animation: blink 0.6s infinite;
        }
        
        .subHeader {
          font-family: "Sixtyfour", sans-serif;
          font-optical-sizing: auto;
          font-weight: 100;
          font-style: normal;
          cursor: pointer;
          pointer-events: auto;
        }
        
        .subHeader:hover {
          color: white;
        }
        
        #blink {
          color: #2b2b2b;
        }
        
        .countdown-padding {
          padding-left: 8px;
        }
      `}</style>

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Sixtyfour:SCAN@-37&display=swap" rel="stylesheet" />

      <div className="header">
        <h1>READ<span className="" id="blink">.</span>VIDE<span id="countdown" className="countdown-padding">3</span></h1>
        <h2 className="subHeader"></h2>
      </div>

      {/* Film grain effect using noise texture */}
      <div className="film-grain"></div>





      <div
        ref={mountRef}
        style={{
          width: '100%',
          height: '100vh',
          cursor: 'grab'
        }}
        onMouseDown={() => {
          const mount = mountRef.current
          if (mount) mount.style.cursor = 'grabbing'
        }}
        onMouseUp={() => {
          const mount = mountRef.current
          if (mount) mount.style.cursor = 'grab'
        }}
      />
    </>
  )
}