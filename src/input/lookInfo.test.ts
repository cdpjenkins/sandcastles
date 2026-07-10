import { describe, it, expect } from 'vitest'
import { getLookInfo } from './LookInfo.ts'
import { Grid } from '../core/Grid.ts'
import { WaterSim } from '../sim/WaterSim.ts'

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
