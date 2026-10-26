'use client'

import dynamic from 'next/dynamic'

// ssr: false keeps Three.js out of the initial bundle AND out of prerendering;
// the statically-exported header HTML paints before any Three.js parses.
const SceneView = dynamic(() => import('./SceneView'), { ssr: false })

export default function SceneMount() {
  return <SceneView />
}
