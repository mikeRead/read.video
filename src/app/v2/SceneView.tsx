'use client'

// Mounts the imperative Three.js scene. Loaded via next/dynamic (ssr: false)
// so Three.js lives in an async chunk and the header HTML paints first.
import { useEffect, useRef } from 'react'
import { createV2Scene } from './scene'

export default function SceneView() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const { renderer, getDebug, dispose } = createV2Scene(mount)

    // Expose render stats for perf verification (no logging)
    ;(window as unknown as Record<string, unknown>).__V2_DEBUG = {
      renderer,
      getDebug,
      calls: () => renderer.info.render.calls,
      triangles: () => renderer.info.render.triangles
    }

    // Fade the canvas in when the countdown lands on "O" (3s), like V1
    const fadeTimer = setTimeout(() => {
      renderer.domElement.classList.add('fade-in-canvas')
    }, 3000)

    return () => {
      clearTimeout(fadeTimer)
      delete (window as unknown as Record<string, unknown>).__V2_DEBUG
      dispose()
    }
  }, [])

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100vh', cursor: 'grab' }}
      onMouseDown={() => { if (mountRef.current) mountRef.current.style.cursor = 'grabbing' }}
      onMouseUp={() => { if (mountRef.current) mountRef.current.style.cursor = 'grab' }}
    />
  )
}
