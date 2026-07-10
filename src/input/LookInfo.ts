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

const FLOW_ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗']
const FLOW_EPSILON = 1e-4

function flowArrow(flowX: number, flowZ: number): string {
  if (Math.hypot(flowX, flowZ) < FLOW_EPSILON) return '·'
  const angle = Math.atan2(flowZ, flowX)
  const sector = Math.round(angle / (Math.PI / 4) + 8) % 8
  return FLOW_ARROWS[sector]!
}

export function formatLookInfo(info: LookInfo): string {
  const moisturePct = Math.round(info.moisture * 100)
  return [
    `Cell (${info.x}, ${info.z})`,
    `Sand ${info.sandHeight.toFixed(2)}  Rock ${info.rockHeight.toFixed(2)}  Surface ${info.surfaceHeight.toFixed(2)}`,
    `Water ${info.waterHeight.toFixed(2)}  Moisture ${moisturePct}%`,
    `Sediment ${info.sediment.toFixed(2)}  Source ${info.sourceRate.toFixed(2)}`,
    `Flow ${info.velocity.toFixed(2)} ${flowArrow(info.flowX, info.flowZ)}`,
  ].join('\n')
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
