# 🔧 Mobile WebGL Debugging Guide

## Why Your Space Scene Doesn't Work on Android Chrome

### 🚨 **Common Causes:**

1. **WebGL Context Loss** - Mobile browsers aggressively kill WebGL contexts
2. **Memory Limitations** - Mobile devices have limited GPU memory
3. **Performance Overload** - Too many stars/planets crash mobile GPUs
4. **Touch Event Conflicts** - Touch events can interfere with WebGL
5. **Browser Compatibility** - Older Android Chrome versions have WebGL bugs

### 🧪 **Quick Debug Steps:**

#### **Step 1: Check WebGL Support**
Open Chrome on your Android device and go to:
```
chrome://gpu
```
Look for:
- ✅ **WebGL**: Hardware accelerated
- ✅ **WebGL2**: Hardware accelerated

#### **Step 2: Check Console Errors**
1. Connect your phone to computer
2. Open Chrome DevTools
3. Check for WebGL errors in console

#### **Step 3: Test Basic WebGL**
Visit: https://get.webgl.org/
- Should show a spinning cube
- If not, WebGL is disabled or unsupported

### 🛠️ **Immediate Fixes:**

#### **Fix 1: Clear Browser Data**
1. Chrome → Settings → Privacy and security
2. Clear browsing data
3. Restart Chrome

#### **Fix 2: Disable Battery Optimization**
1. Android Settings → Apps → Chrome
2. Battery → Unrestricted

#### **Fix 3: Force GPU Rendering**
1. Chrome → chrome://flags
2. Search "GPU"
3. Enable "GPU rasterization"
4. Restart Chrome

### 📱 **Mobile-Specific Issues:**

#### **Android Chrome Issues:**
- **WebGL context lost** when switching apps
- **Memory pressure** kills WebGL contexts
- **Battery optimization** throttles GPU
- **Touch events** conflict with WebGL

#### **Performance Issues:**
- **Too many stars** (25,000 → 15,000 on mobile)
- **High-resolution textures** (128px → 64px on mobile)
- **Complex shaders** cause frame drops
- **MSAA** (4x → 2x on mobile)

### 🔍 **Debugging Commands:**

Add this to your page for mobile debugging:

```javascript
// Check WebGL support
console.log('WebGL Support:', !!window.WebGLRenderingContext)

// Check renderer info
const canvas = document.createElement('canvas')
const gl = canvas.getContext('webgl')
if (gl) {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  if (debugInfo) {
    console.log('GPU:', gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
    console.log('Vendor:', gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
  }
}
```

### 🚀 **Quick Mobile Test:**

1. **Reduce complexity** - Fewer stars, simpler effects
2. **Disable expensive features** - Shadows, MSAA, complex shaders
3. **Add error handling** - Catch WebGL context loss
4. **Mobile detection** - Apply optimizations automatically

### 📞 **Still Not Working?**

Try these alternatives:
1. **Firefox Mobile** - Often better WebGL support
2. **Samsung Internet** - Good Android WebGL support
3. **Update Chrome** - Latest versions fix WebGL bugs
4. **Check device** - Some older devices don't support WebGL 2.0

### 🎯 **Mobile Optimization Checklist:**

- [ ] Reduce star count to 15,000
- [ ] Disable antialiasing on mobile
- [ ] Use medium precision shaders
- [ ] Reduce texture sizes
- [ ] Add WebGL context loss handling
- [ ] Test touch events work
- [ ] Check memory usage
- [ ] Add mobile error messages
