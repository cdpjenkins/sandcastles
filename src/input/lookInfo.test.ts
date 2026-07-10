import { describe, it, expect } from 'vitest'
import { getLookInfo, formatLookInfo, type LookInfo } from './LookInfo.ts'
import { Grid } from '../core/Grid.ts'
import { WaterSim } from '../sim/WaterSim.ts'

const makeInfo = (overrides: Partial<LookInfo> = {}): LookInfo => ({
  x: 5,
  z: 9,
  rockHeight: 1,
  sandHeight: 3,
  surfaceHeight: 4,
  waterHeight: 0.75,
  moisture: 0.6,
  sediment: 0.2,
  sourceRate: 0,
  flowX: 0,
  flowZ: 0,
  velocity: 0,
  ...overrides,
})

describe('getLookInfo', () => {
  it('reads grid and water sim state at the given cell', () => {
    const grid = new Grid(4, 4)
    grid.setRockHeight(2, 1, 1.5)
    grid.setSandHeight(2, 1, 3.0)
    grid.setWaterHeight(2, 1, 0.75)
    grid.setMoisture(2, 1, 0.6)
    grid.setSediment(2, 1, 0.2)
    grid.setSourceRate(2, 1, 3.0)

    const waterSim = new WaterSim(grid.width, grid.depth)
    waterSim.setFlowX(2, 1, 1.2)
    waterSim.setFlowZ(2, 1, -0.4)

    const info = getLookInfo(grid, waterSim, 2, 1)

    expect(info.x).toBe(2)
    expect(info.z).toBe(1)
    expect(info.rockHeight).toBeCloseTo(1.5)
    expect(info.sandHeight).toBeCloseTo(3.0)
    expect(info.surfaceHeight).toBeCloseTo(4.5)
    expect(info.waterHeight).toBeCloseTo(0.75)
    expect(info.moisture).toBeCloseTo(0.6)
    expect(info.sediment).toBeCloseTo(0.2)
    expect(info.sourceRate).toBeCloseTo(3.0)
    expect(info.flowX).toBeCloseTo(1.2)
    expect(info.flowZ).toBeCloseTo(-0.4)
    expect(info.velocity).toBe(waterSim.getVelocity(2, 1))
  })
})

describe('formatLookInfo', () => {
  it('includes cell coordinates and height/moisture/sediment/source fields', () => {
    const text = formatLookInfo(
      makeInfo({
        x: 5,
        z: 9,
        rockHeight: 1,
        sandHeight: 3,
        surfaceHeight: 4,
        waterHeight: 0.75,
        moisture: 0.6,
        sediment: 0.2,
        sourceRate: 2.5,
      }),
    )

    expect(text).toContain('(5, 9)')
    expect(text).toContain('Sand 3.00')
    expect(text).toContain('Rock 1.00')
    expect(text).toContain('Surface 4.00')
    expect(text).toContain('Water 0.75')
    expect(text).toContain('Moisture 60%')
    expect(text).toContain('Sediment 0.20')
    expect(text).toContain('Source 2.50')
  })

  it.each([
    [1, 0, '↘'],
    [0, 1, '↙'],
    [-1, 0, '↖'],
    [0, -1, '↗'],
    [1, 1, '↓'],
    [1, -1, '→'],
    [-1, -1, '↑'],
    [-1, 1, '←'],
  ])('renders flowX=%d flowZ=%d (world axes) as %s on screen', (flowX, flowZ, arrow) => {
    const text = formatLookInfo(makeInfo({ flowX, flowZ, velocity: 1.4 }))

    expect(text).toContain(`Flow 1.40 ${arrow}`)
  })

  it('renders a neutral marker when there is no flow', () => {
    const text = formatLookInfo(makeInfo({ flowX: 0, flowZ: 0, velocity: 0 }))

    expect(text).toContain('Flow 0.00 ·')
  })
})
