import type { Metadata } from 'next'
import Header from './Header'
import SceneMount from './SceneMount'

export const metadata: Metadata = {
  title: 'Read.Video',
  description: 'Interactive space-themed landing page'
}

// Server shell: static header markup prerenders into the exported HTML;
// the Three.js scene loads as a deferred client-only chunk.
export default function V2Page() {
  return (
    <>
      <Header />
      <SceneMount />
    </>
  )
}
