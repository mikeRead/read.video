// Mobile WebGL error handling for Android Chrome

export const setupMobileErrorHandling = () => {
    // Handle WebGL not supported
    if (!window.WebGLRenderingContext) {
        showMobileError('WebGL not supported on this device')
        return false
    }

    // Handle WebGL context creation failures
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')

    if (!gl) {
        showMobileError('Unable to create WebGL context. Try updating your browser.')
        return false
    }

    // Check for common mobile WebGL limitations
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        console.log('WebGL Renderer:', renderer)

        // Check for known problematic mobile GPUs
        if (renderer.includes('Mali') || renderer.includes('PowerVR') || renderer.includes('Adreno')) {
            console.warn('Mobile GPU detected - applying optimizations')
        }
    }

    return true
}

export const showMobileError = (message: string) => {
    // Create error display
    const errorDiv = document.createElement('div')
    errorDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 20px;
    border-radius: 10px;
    text-align: center;
    z-index: 10000;
    font-family: Arial, sans-serif;
    max-width: 300px;
  `

    errorDiv.innerHTML = `
    <h3>⚠️ Mobile Compatibility Issue</h3>
    <p>${message}</p>
    <p><small>Try refreshing the page or updating Chrome</small></p>
    <button onclick="this.parentElement.remove()" style="
      background: #007bff;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      margin-top: 10px;
      cursor: pointer;
    ">OK</button>
  `

    document.body.appendChild(errorDiv)
}

export const createMobileFallback = () => {
    const fallbackDiv = document.createElement('div')
    fallbackDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(45deg, #0a0a0a, #1a1a2e, #16213e);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-family: Arial, sans-serif;
    text-align: center;
    z-index: 9999;
  `

    fallbackDiv.innerHTML = `
    <div>
      <h1>🌟 Space Scene</h1>
      <p>Your device is experiencing WebGL compatibility issues.</p>
      <p>Try:</p>
      <ul style="text-align: left; display: inline-block;">
        <li>Refreshing the page</li>
        <li>Updating Chrome</li>
        <li>Closing other apps</li>
        <li>Using a different browser</li>
      </ul>
      <button onclick="location.reload()" style="
        background: #007bff;
        color: white;
        border: none;
        padding: 15px 30px;
        border-radius: 8px;
        margin-top: 20px;
        font-size: 16px;
        cursor: pointer;
      ">🔄 Retry</button>
    </div>
  `

    return fallbackDiv
}
