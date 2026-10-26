import type { Metadata } from 'next'
import Header from './v2/Header'
import SceneMount from './v2/SceneMount'

export const metadata: Metadata = {
  title: 'Read.Video',
  description: 'Interactive space-themed landing page'
}

// The V2 scene IS the homepage: static header markup prerenders into the
// exported HTML; the Three.js scene loads as a deferred client-only chunk.
// The previous page is preserved at /v1.
export default function HomePage() {
  return (
    <>
      <Header />
      <SceneMount />
    </>
  )
}
