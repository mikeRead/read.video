// Mobile WebGL optimizations for Android Chrome compatibility
import * as THREE from 'three'

export const isMobile = () => {
    // Check for query parameter first (for testing on PC)
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('phone') === 'true') {
        console.log('🔧 Mobile mode enabled via query parameter ?phone=true')
        return true
    }

    // Then check actual device
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export const isAndroid = () => {
    return /Android/i.test(navigator.userAgent)
}

export const getMobileOptimizations = () => {
    const mobile = isMobile()
    const android = isAndroid()

    // Show mobile indicator if mobile mode is active
    if (mobile) {
        showMobileIndicator()
    }

    return {
        // Reduce star count on mobile
        maxStars: mobile ? 15000 : 25000,

        // Reduce particle count
        maxParticles: mobile ? 2000 : 4000,

        // Reduce planet count
        maxPlanets: mobile ? 8 : 15,

        // Disable expensive effects on mobile
        disableEffects: mobile,

        // Reduce MSAA samples
        msaaSamples: mobile ? 2 : 4,

        // Use lower precision on mobile
        useHalfFloat: !mobile,

        // Reduce texture sizes
        textureSize: mobile ? 64 : 128,

        // Disable shadows on mobile
        enableShadows: !mobile,

        // Reduce glitch frequency
        glitchInterval: mobile ? 8000 : 5000,

        // Lower chroma intensity on mobile
        chromaIntensity: mobile ? 0.003 : 0.005
    }
}

// Show a visual indicator when mobile mode is active
const showMobileIndicator = () => {
    // Remove existing indicator if present
    const existing = document.getElementById('mobile-indicator')
    if (existing) existing.remove()

    const indicator = document.createElement('div')
    indicator.id = 'mobile-indicator'
    indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #ff6b6b;
    color: white;
    padding: 8px 12px;
    border-radius: 20px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    font-weight: bold;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    pointer-events: none;
  `
    indicator.textContent = '📱 MOBILE MODE'

    document.body.appendChild(indicator)

    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (indicator.parentElement) {
            indicator.style.opacity = '0.7'
        }
    }, 5000)
}

// Debug function to show current mobile optimizations
export const debugMobileOptimizations = () => {
    const mobile = isMobile()
    const optimizations = getMobileOptimizations()

    console.group('🔧 Mobile Optimizations Debug')
    console.log('Mobile Mode:', mobile)
    console.log('Query Param ?phone=true:', new URLSearchParams(window.location.search).get('phone') === 'true')
    console.log('User Agent:', navigator.userAgent)
    console.log('Optimizations:', optimizations)
    console.groupEnd()

    return optimizations
}

// Mobile font loading optimization
export const optimizeFontsForMobile = () => {
    const mobile = isMobile()

    if (mobile) {
        // Force font display swap for better mobile performance
        const style = document.createElement('style')
        style.textContent = `
      @font-face {
        font-family: 'Sixtyfour';
        font-display: swap;
      }
      * {
        font-display: swap;
      }
    `
        document.head.appendChild(style)

        // Preload critical fonts on mobile
        const fontPreload = document.createElement('link')
        fontPreload.rel = 'preload'
        fontPreload.href = 'https://fonts.googleapis.com/css2?family=Sixtyfour:SCAN@-37&display=swap'
        fontPreload.as = 'style'
        document.head.appendChild(fontPreload)

        // Add fallback font loading with timeout
        setTimeout(() => {
            // Check if Sixtyfour font loaded successfully (cross-browser compatible)
            const fontLoaded = document.fonts && document.fonts.check ?
                document.fonts.check('12px Sixtyfour') :
                document.fonts.load('12px Sixtyfour').then(() => true).catch(() => false)

            if (typeof fontLoaded === 'boolean' && !fontLoaded) {
                console.warn('🔤 Sixtyfour font failed to load, using fallback fonts')
                // Force fallback fonts
                const fallbackStyle = document.createElement('style')
                fallbackStyle.textContent = `
          .subHeader {
            font-family: "Courier New", "Monaco", "Menlo", "Consolas", "Roboto Mono", monospace !important;
          }
        `
                document.head.appendChild(fallbackStyle)
            } else if (typeof fontLoaded === 'object') {
                // Handle Promise-based font loading
                fontLoaded.then((loaded) => {
                    if (!loaded) {
                        console.warn('🔤 Sixtyfour font failed to load, using fallback fonts')
                        const fallbackStyle = document.createElement('style')
                        fallbackStyle.textContent = `
              .subHeader {
                font-family: "Courier New", "Monaco", "Menlo", "Consolas", "Roboto Mono", monospace !important;
              }
            `
                        document.head.appendChild(fallbackStyle)
                    }
                })
            }
        }, 3000) // Wait 3 seconds for font to load

        console.log('🔤 Mobile font optimizations applied')
    }
}

export const createMobileRenderer = () => {
    const mobile = isMobile()

    return {
        antialias: !mobile, // Disable antialiasing on mobile for performance
        powerPreference: mobile ? "default" : "high-performance",
        logarithmicDepthBuffer: !mobile, // Can cause issues on mobile
        stencil: false,
        depth: true,
        alpha: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false,
        // Add mobile-specific options
        precision: mobile ? "mediump" : "highp"
    }
}

export const handleWebGLContextLoss = (renderer: THREE.WebGLRenderer, onContextLost: () => void) => {
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
        event.preventDefault()
        console.warn('WebGL context lost on mobile - attempting recovery')
        onContextLost()
    }, false)

    renderer.domElement.addEventListener('webglcontextrestored', () => {
        console.log('WebGL context restored')
    }, false)
}

export const optimizeForMobile = (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => {
    const mobile = isMobile()

    if (mobile) {
        // Reduce camera far plane for better performance
        camera.far = 30000
        camera.updateProjectionMatrix()

        // Reduce fog density if present (only for exponential fog)
        if (scene.fog && 'density' in scene.fog) {
            (scene.fog as THREE.FogExp2).density = (scene.fog as THREE.FogExp2).density * 0.5
        }
    }
}
