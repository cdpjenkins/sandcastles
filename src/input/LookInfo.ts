import type { Grid } from '../core/Grid.ts'
import type { WaterSim } from '../sim/WaterSim.ts'
import { worldToScreenDirection } from '../render/isoProjection.ts'
import { saturation } from '../sim/Moisture.ts'

export interface LookInfo {
  readonly x: number
  readonly z: number
  readonly rockHeight: number
  readonly sandHeight: number
  readonly bedHeight: number
  readonly waterDepth: number
  readonly waterSurfaceHeight: number
  // How full the sand is, 0-1, and the water that is.
  readonly moisture: number
  readonly heldWater: number
  readonly sediment: number
  readonly sourceRate: number
  readonly flowX: number
  readonly flowZ: number
  readonly velocity: number
}

const FLOW_ARROWS = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘']
const FLOW_EPSILON = 1e-4

function flowArrow(flowX: number, flowZ: number): string {
  if (Math.hypot(flowX, flowZ) < FLOW_EPSILON) return '·'
  const { right, up } = worldToScreenDirection(flowX, flowZ)
  const angle = Math.atan2(up, right)
  const sector = (Math.round(angle / (Math.PI / 4)) + 8) % 8
  return FLOW_ARROWS[sector]!
}

export function formatLookInfo(info: LookInfo): string {
  const moisturePct = Math.round(info.moisture * 100)
  const waterTop = info.waterDepth === 0 ? '—' : info.waterSurfaceHeight.toFixed(2)
  return [
    `Cell (${info.x}, ${info.z})`,
    `Sand ${info.sandHeight.toFixed(2)}  Rock ${info.rockHeight.toFixed(2)}  Bed ${info.bedHeight.toFixed(2)}`,
    `Depth ${info.waterDepth.toFixed(2)}  Water top ${waterTop}`,
    `Moisture ${moisturePct}% (${info.heldWater.toFixed(4)} held)`,
    `Sediment ${info.sediment.toFixed(2)}  Source ${info.sourceRate.toFixed(2)}`,
    `Flow ${info.velocity.toFixed(2)} ${flowArrow(info.flowX, info.flowZ)}`,
  ].join('\n')
}

export function getLookInfo(grid: Grid, waterSim: WaterSim, x: number, z: number): LookInfo {
  const heldWater = grid.getMoisture(x, z) ?? 0
  return {
    x,
    z,
    rockHeight: grid.getRockHeight(x, z) ?? 0,
    sandHeight: grid.getSandHeight(x, z) ?? 0,
    bedHeight: grid.getSurfaceHeight(x, z) ?? 0,
    waterDepth: grid.getWaterHeight(x, z) ?? 0,
    waterSurfaceHeight: grid.getWaterSurfaceHeight(x, z) ?? 0,
    moisture: saturation(heldWater, grid.getSandHeight(x, z) ?? 0, grid.getWaterHeight(x, z) ?? 0),
    heldWater,
    sediment: grid.getSediment(x, z) ?? 0,
    sourceRate: grid.getSourceRate(x, z) ?? 0,
    flowX: waterSim.getFlowX(x, z),
    flowZ: waterSim.getFlowZ(x, z),
    velocity: waterSim.getVelocity(x, z),
  }
}
