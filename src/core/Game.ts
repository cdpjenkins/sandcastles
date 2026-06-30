import { Grid } from './Grid.ts'
import { Renderer } from '../render/Renderer.ts'
import { IsoCamera } from '../render/IsoCamera.ts'
import { TerrainMesh } from '../render/TerrainMesh.ts'
import { Picker } from '../input/Picker.ts'

const SIM_HZ = 30
const SIM_STEP = 1 / SIM_HZ

export class Game {
  private readonly grid: Grid
  private readonly renderer: Renderer
  private readonly isoCamera: IsoCamera
  private readonly terrain: TerrainMesh
  private readonly picker: Picker

  private simAccumulator = 0
  private lastTime = 0

  constructor() {
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'display:block;width:100%;height:100%'
    document.body.style.cssText = 'margin:0;overflow:hidden;background:#000'
    document.body.appendChild(canvas)

    this.grid = new Grid(256, 256)
    this.grid.initBeach()

    this.renderer = new Renderer(canvas)
    this.isoCamera = new IsoCamera(canvas)
    this.terrain = new TerrainMesh(this.grid)
    this.renderer.scene.add(this.terrain.mesh)

    this.picker = new Picker(
      canvas,
      this.isoCamera.camera,
      this.terrain.mesh,
      this.grid.width,
      this.grid.depth,
    )
    this.picker.onCellPick(({ x, z }) => {
      console.log(`cell picked: { x: ${x}, z: ${z} }`)
    })

    requestAnimationFrame(this.loop)
  }

  private loop = (timestamp: number): void => {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1)
    this.lastTime = timestamp

    this.simAccumulator += dt
    while (this.simAccumulator >= SIM_STEP) {
      this.simStep(SIM_STEP)
      this.simAccumulator -= SIM_STEP
    }

    this.renderer.render(this.isoCamera.camera)
    requestAnimationFrame(this.loop)
  }

  private simStep(_dt: number): void {
    // placeholder — simulation systems added in M3+
  }
}
