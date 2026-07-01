import { Grid } from './Grid.ts'
import { Bucket } from './Bucket.ts'
import { Renderer } from '../render/Renderer.ts'
import { IsoCamera } from '../render/IsoCamera.ts'
import { TerrainMesh } from '../render/TerrainMesh.ts'
import { Picker } from '../input/Picker.ts'
import { ToolMode, dig, dump } from '../input/Tools.ts'
import { WaterSim } from '../sim/WaterSim.ts'
import { Erosion } from '../sim/Erosion.ts'
import { Moisture } from '../sim/Moisture.ts'
import { Slope } from '../sim/Slope.ts'
import { Waves } from '../sim/Waves.ts'
import { orInto } from '../sim/combineDirty.ts'
import { WaveAudio } from '../audio/WaveAudio.ts'

const SIM_HZ = 30
const SIM_STEP = 1 / SIM_HZ
const BUCKET_CAPACITY = 10
const STREAM_RATE = 3.0

export class Game {
  private readonly grid: Grid
  private readonly bucket: Bucket
  private readonly waterSim: WaterSim
  private readonly erosion: Erosion
  private readonly moisture: Moisture
  private readonly slope: Slope
  private readonly waves: Waves
  private readonly waveAudio: WaveAudio
  private readonly combinedDirty: Uint8Array
  private readonly seaStart: number
  private readonly renderer: Renderer
  private readonly isoCamera: IsoCamera
  private readonly terrain: TerrainMesh
  private readonly picker: Picker
  private readonly hud: HTMLDivElement
  private readonly helpOverlay: HTMLDivElement

  private toolMode: ToolMode = ToolMode.Spade
  private simAccumulator = 0
  private lastTime = 0

  constructor() {
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'display:block;width:100%;height:100%'
    document.body.style.cssText = 'margin:0;overflow:hidden;background:#000'
    document.body.appendChild(canvas)

    this.hud = document.createElement('div')
    this.hud.style.cssText =
      'position:fixed;top:12px;left:12px;color:#fff;font:14px/1.4 monospace;' +
      'background:rgba(0,0,0,0.45);padding:6px 10px;border-radius:6px;pointer-events:none'
    document.body.appendChild(this.hud)

    this.helpOverlay = document.createElement('div')
    this.helpOverlay.style.cssText =
      'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'color:#fff;font:15px/1.8 monospace;background:rgba(0,0,0,0.75);' +
      'padding:20px 28px;border-radius:10px;pointer-events:none;white-space:pre'
    this.helpOverlay.textContent = [
      'Controls',
      '────────',
      'S        Spade (dig)',
      'D        Toggle Spade / Dump',
      'W        Water stream',
      'R        Reset water',
      'Pinch    Zoom',
      '2-finger Pan',
      '?        Toggle this help',
    ].join('\n')
    document.body.appendChild(this.helpOverlay)

    this.grid = new Grid(256, 256)
    this.grid.initBeach()
    this.bucket = new Bucket(BUCKET_CAPACITY)
    this.waterSim = new WaterSim(this.grid.width, this.grid.depth)
    this.erosion = new Erosion(this.grid.width, this.grid.depth)
    this.moisture = new Moisture(this.grid.width, this.grid.depth)
    this.slope = new Slope(this.grid.width, this.grid.depth)
    this.waves = new Waves(this.grid.width, this.grid.depth)
    this.waveAudio = new WaveAudio()
    this.combinedDirty = new Uint8Array(this.grid.width * this.grid.depth)
    this.seaStart = Math.floor(this.grid.depth * 0.75)

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
    this.picker.onCellPick(({ x, z }) => this.onCellPick(x, z))

    window.addEventListener('keydown', this.onKeyDown)

    this.updateHud()
    requestAnimationFrame(this.loop)
  }

  private onCellPick(x: number, z: number): void {
    if (this.toolMode === ToolMode.Stream) {
      this.grid.setSourceRate(x, z, STREAM_RATE)
      this.updateHud()
      return
    }

    let changed = false
    if (this.toolMode === ToolMode.Spade) {
      changed = dig(this.grid, x, z, this.bucket)
    } else {
      changed = dump(this.grid, x, z, this.bucket)
    }
    if (changed) {
      this.terrain.updateDirtyRegion(x, z, x, z)
      this.updateHud()
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'd' || e.key === 'D') {
      this.toolMode =
        this.toolMode === ToolMode.Spade ? ToolMode.Dump : ToolMode.Spade
      this.updateHud()
    }
    if (e.key === 'w' || e.key === 'W') {
      this.toolMode = ToolMode.Stream
      this.updateHud()
    }
    if (e.key === 's' || e.key === 'S') {
      this.toolMode = ToolMode.Spade
      this.updateHud()
    }
    if (e.key === 'r' || e.key === 'R') {
      this.resetWater()
    }
    if (e.key === '?') {
      const visible = this.helpOverlay.style.display === 'block'
      this.helpOverlay.style.display = visible ? 'none' : 'block'
    }
  }

  private resetWater(): void {
    for (let z = 0; z < this.grid.depth; z++) {
      for (let x = 0; x < this.grid.width; x++) {
        this.grid.setWaterHeight(x, z, 0)
        this.grid.setSourceRate(x, z, 0)
      }
    }
    this.waterSim.reset()
    this.terrain.rebuildAll()
  }

  private updateHud(): void {
    const icons: Record<ToolMode, string> = {
      [ToolMode.Spade]: '⛏ Spade',
      [ToolMode.Dump]: '🪣 Dump',
      [ToolMode.Stream]: '💧 Stream',
    }
    const fill = `${this.bucket.amount.toFixed(1)} / ${this.bucket.capacity}`
    const wave = `wave: ${Math.ceil(this.waves.timeUntilWave)}s`
    this.hud.textContent = `${icons[this.toolMode]}   bucket: ${fill}   ${wave}`
  }

  private loop = (timestamp: number): void => {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1)
    this.lastTime = timestamp

    this.simAccumulator += dt
    while (this.simAccumulator >= SIM_STEP) {
      this.simStep(SIM_STEP)
      this.simAccumulator -= SIM_STEP
    }

    this.updateHud()
    this.renderer.render(this.isoCamera.camera)
    requestAnimationFrame(this.loop)
  }

  private simStep(dt: number): void {
    const wavesDirty = this.waves.step(this.grid, dt, this.seaStart)
    if (this.waves.fired) this.waveAudio.play()
    const waterDirty = this.waterSim.step(this.grid, dt)
    const erosionDirty = this.erosion.step(this.grid, this.waterSim, dt)
    const moistureDirty = this.moisture.step(this.grid, dt)
    const slopeDirty = this.slope.step(this.grid)

    orInto(this.combinedDirty, wavesDirty, waterDirty, erosionDirty, moistureDirty, slopeDirty)
    this.terrain.updateDirtyCells(this.combinedDirty)
  }
}
