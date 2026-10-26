// Shooting stars: fixed pool, one shared geometry, real delta time.
// V1 allocated a fresh SphereGeometry + material per spawn and never disposed
// either (~1,800 leaked pairs/hour); it also hardcoded dt=1/60.
import {
  AdditiveBlending,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3
} from 'three'

const POOL_SIZE = 4

interface PoolEntry {
  mesh: Mesh
  material: MeshBasicMaterial
  velocity: Vector3
  life: number
  maxLife: number
  active: boolean
}

export interface ShootingStars {
  group: Group
  update: (dtSec: number, nowMs: number) => void
  dispose: () => void
}

export function createShootingStars(): ShootingStars {
  const group = new Group()
  const geometry = new SphereGeometry(10, 12, 12)
  const pool: PoolEntry[] = []

  for (let i = 0; i < POOL_SIZE; i++) {
    const material = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false
    })
    const mesh = new Mesh(geometry, material)
    mesh.visible = false
    mesh.renderOrder = 3
    group.add(mesh)
    pool.push({ mesh, material, velocity: new Vector3(), life: 0, maxLife: 0, active: false })
  }

  let nextSpawnAt = 0

  const spawn = (entry: PoolEntry) => {
    const startDist = 6000 + Math.random() * 6000
    const startAngle = Math.random() * Math.PI * 2
    entry.mesh.position.set(
      Math.cos(startAngle) * startDist,
      (Math.random() - 0.5) * 600,
      Math.sin(startAngle) * startDist
    )
    const dirAngle = startAngle + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2)
    entry.velocity.set(
      Math.cos(dirAngle),
      (Math.random() - 0.5) * 0.3,
      Math.sin(dirAngle)
    ).normalize().multiplyScalar(900 + Math.random() * 14300)
    entry.maxLife = 1 + Math.random() * 2
    entry.life = entry.maxLife
    entry.active = true
    entry.mesh.visible = true
    entry.material.opacity = 0.95
  }

  return {
    group,
    update: (dtSec: number, nowMs: number) => {
      if (nowMs >= nextSpawnAt) {
        const idle = pool.find(e => !e.active)
        if (idle) spawn(idle)
        nextSpawnAt = nowMs + 600 + Math.random() * 3500
      }
      for (const e of pool) {
        if (!e.active) continue
        e.mesh.position.addScaledVector(e.velocity, dtSec)
        e.life -= dtSec
        e.material.opacity = Math.max(0, (e.life / e.maxLife) * 0.95)
        if (e.life <= 0) {
          e.active = false
          e.mesh.visible = false
        }
      }
    },
    dispose: () => {
      geometry.dispose()
      for (const e of pool) e.material.dispose()
    }
  }
}
