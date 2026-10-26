// Visual style presets, switchable via ?style= (classic | vapor | dream).
// Orthogonal to the quality tier (?phone=true).
import { Color } from 'three'

export interface StylePreset {
  name: 'classic' | 'vapor' | 'dream'
  nebula: {
    /** Fixed base hue in degrees; null = random 180-340 like V1 */
    hue: number | null
    intensity: number
  }
  stars: {
    sizeMul: number
    /** Writes this star's color into `c` */
    pick: (c: Color) => void
  }
  planets: {
    /** Returns a hue in [0,1); receives the nebula's base hue (degrees) */
    pickHue: (baseHue: number | null) => number
    sat: number
    light: number
    /** 0 disables the atmospheric halo sprite */
    glow: number
    /** Hero planet becomes a striped vaporwave sun */
    vaporSun: boolean
    ringChance: number
  }
  post: {
    /** Constant subtle chroma aberration outside glitches (desktop only) */
    baseChroma: number
  }
}

const classicHue = (baseHue: number | null) =>
  baseHue !== null && Math.random() < 0.4
    ? (((baseHue + (Math.random() - 0.5) * 60) / 360) % 1 + 1) % 1
    : Math.random()

const pickWeighted = <T,>(entries: [number, T][]): T => {
  let r = Math.random()
  for (const [w, v] of entries) {
    if (r < w) return v
    r -= w
  }
  return entries[entries.length - 1][1]
}

const PRESETS: Record<StylePreset['name'], StylePreset> = {
  classic: {
    name: 'classic',
    nebula: { hue: null, intensity: 0.60 },
    stars: {
      sizeMul: 1,
      pick: (c) => {
        if (Math.random() < 0.90) c.setRGB(1, 1, 1)
        else c.setHSL(Math.random(), 0.8, 0.7)
      }
    },
    planets: { pickHue: classicHue, sat: 0.9, light: 0.65, glow: 0, vaporSun: false, ringChance: 0.5 },
    post: { baseChroma: 0 }
  },

  vapor: {
    name: 'vapor',
    // Violet-magenta nebula, pushed a little brighter
    nebula: { hue: 290, intensity: 0.7 },
    stars: {
      sizeMul: 1.35,
      // 70% white, 15% cyan, 15% hot pink
      pick: (c) => {
        const [h, s, l] = pickWeighted<[number, number, number]>([
          [0.70, [0, 0, 1]],          // white (s=0)
          [0.15, [0.5, 0.9, 0.72]],   // cyan
          [0.15, [0.87, 0.9, 0.72]]   // hot pink
        ])
        c.setHSL(h, s, l)
      }
    },
    planets: {
      // Pink / cyan / violet only — the vaporwave trio
      pickHue: () =>
        pickWeighted([
          [0.4, 0.85 + (Math.random() - 0.5) * 0.06],  // hot pink / magenta
          [0.35, 0.5 + (Math.random() - 0.5) * 0.05],  // cyan
          [0.25, 0.73 + (Math.random() - 0.5) * 0.05]  // violet
        ]),
      sat: 0.9,
      light: 0.62,
      glow: 1,
      vaporSun: true,
      ringChance: 0.65
    },
    post: { baseChroma: 0.0025 }
  },

  dream: {
    name: 'dream',
    // Soft blue nebula, gentler
    nebula: { hue: 215, intensity: 0.45 },
    stars: {
      sizeMul: 1.15,
      pick: (c) => {
        if (Math.random() < 0.95) c.setRGB(1, 1, 1)
        else c.setHSL(0.55 + Math.random() * 0.15, 0.5, 0.8)
      }
    },
    // Pastels (lightness kept below the point where ×1.5 brightness clips to white)
    planets: { pickHue: () => Math.random(), sat: 0.55, light: 0.65, glow: 0.8, vaporSun: false, ringChance: 0.5 },
    post: { baseChroma: 0 }
  }
}

export function getStyle(): StylePreset {
  const name = new URLSearchParams(window.location.search).get('style')
  if (name === 'classic' || name === 'dream') return PRESETS[name]
  // Vapor is the default look — fixed violet nebula, pink/cyan planets, the sun
  return PRESETS.vapor
}
