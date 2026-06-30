export const Material = {
  Rock: 0,
  Sand: 1,
  Gravel: 2,
  Pebble: 3,
  Water: 4,
} as const

export type Material = (typeof Material)[keyof typeof Material]

export interface MaterialProps {
  readonly diggable: boolean
  readonly erodibility: number
  readonly angleOfRepose: number
  readonly colour: string
}

export const MATERIAL_PROPS: Readonly<Record<Material, MaterialProps>> = {
  [Material.Rock]: {
    diggable: false,
    erodibility: 0,
    angleOfRepose: 90,
    colour: '#6b6b6b',
  },
  [Material.Sand]: {
    diggable: true,
    erodibility: 0.6,
    angleOfRepose: 34,
    colour: '#c2a06e',
  },
  [Material.Gravel]: {
    diggable: true,
    erodibility: 0.3,
    angleOfRepose: 40,
    colour: '#9e8c6e',
  },
  [Material.Pebble]: {
    diggable: true,
    erodibility: 0.1,
    angleOfRepose: 45,
    colour: '#7a7060',
  },
  [Material.Water]: {
    diggable: false,
    erodibility: 0,
    angleOfRepose: 0,
    colour: '#3a7bd5',
  },
}
