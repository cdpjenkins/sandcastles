import type { Grid } from '../core/Grid.ts'
import type { WaterSim } from '../sim/WaterSim.ts'

export interface LookInfo {
  readonly x: number
  readonly z: number
  readonly rockHeight: number
  readonly sandHeight: number
  readonly surfaceHeight: number
  readonly waterHeight: number
  readonly moisture: number
  readonly sediment: number
  readonly sourceRate: number
  readonly flowX: number
  readonly flowZ: number
  readonly velocity: number
}

export function getLookInfo(grid: Grid, waterSim: WaterSim, x: number, z: number): LookInfo {
  return {
    x,
    z,
    rockHeight: grid.getRockHeight(x, z) ?? 0,
    sandHeight: grid.getSandHeight(x, z) ?? 0,
    surfaceHeight: grid.getSurfaceHeight(x, z) ?? 0,
    waterHeight: grid.getWaterHeight(x, z) ?? 0,
    moisture: grid.getMoisture(x, z) ?? 0,
    sediment: grid.getSediment(x, z) ?? 0,
    sourceRate: grid.getSourceRate(x, z) ?? 0,
    flowX: waterSim.getFlowX(x, z),
    flowZ: waterSim.getFlowZ(x, z),
    velocity: waterSim.getVelocity(x, z),
  }
}
