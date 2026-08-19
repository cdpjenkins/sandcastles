import { Grid } from './Grid.ts'
import { AutoSaver } from './AutoSaver.ts'
import { createSnapshot } from './GameSnapshot.ts'
import type { GameSnapshot } from './GameSnapshot.ts'
import type { SnapshotStore } from './SnapshotStore.ts'
import { SimClock } from './SimClock.ts'
import { Bucket } from './Bucket.ts'
import { Renderer } from '../render/Renderer.ts'
import { IsoCamera } from '../render/IsoCamera.ts'
import { TerrainMesh } from '../render/TerrainMesh.ts'
import { Picker } from '../input/Picker.ts'
import { ToolMode, dig, dump } from '../input/Tools.ts'
import { toolForKey } from '../input/KeyBindings.ts'
import { Toolbar } from '../input/Toolbar.ts'
import { WaterSim } from '../sim/WaterSim.ts'
import { Erosion } from '../sim/Erosion.ts'
import { Moisture } from '../sim/Moisture.ts'
import { Slope } from '../sim/Slope.ts'
import { Waves } from '../sim/Waves.ts'
import { Sponge } from '../sim/Sponge.ts'
import { Tide } from '../sim/Tide.ts'
import { orInto } from '../sim/combineDirty.ts'
import { getLookInfo, formatLookInfo } from '../input/LookInfo.ts'
import type { GridCoord } from '../types.ts'

const SIM_HZ = 30
const SIM_STEP = 1 / SIM_HZ
// A backgrounded tab hands back one enormous frame; take this much of it and
// let the rest go, so the sim slows down rather than locking the page.
const MAX_FRAME = 0.1
const BUCKET_CAPACITY = 1000
const AUTOSAVE_SECONDS = 5
export const GRID_WIDTH = 256
export const GRID_DEPTH = 256
const STREAM_RATE = 1.0

export class Game {
  private readonly grid: Grid
  private readonly bucket: Bucket
  private readonly waterSim: WaterSim
  private readonly erosion: Erosion
  private readonly moisture: Moisture
  private readonly slope: Slope
  private readonly waves: Waves
  private readonly sponge: Sponge
  private readonly tide: Tide
  private readonly simClock = new SimClock(SIM_STEP, MAX_FRAME)
  private readonly combinedDirty: Uint8Array
  private readonly renderer: Renderer
  private readonly isoCamera: IsoCamera
  private readonly terrain: TerrainMesh
  private readonly picker: Picker
  private readonly toolbar: Toolbar
  private readonly autoSaver: AutoSaver
  private readonly helpOverlay: HTMLDivElement
  private readonly lookPanel: HTMLDivElement

  private toolMode: ToolMode = ToolMode.Spade
  private lastTime = 0
  private lookEnabled = false
  private paused = false
  private hoverCell: GridCoord | null = null

  constructor(store: SnapshotStore, saved: GameSnapshot | null) {
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'display:block;width:100%;height:100%'
    document.body.style.cssText = 'margin:0;overflow:hidden;background:#000'
    document.body.appendChild(canvas)

    this.toolbar = new Toolbar()
    this.toolbar.onToolChange((mode) => this.selectTool(mode))
    this.toolbar.onLookToggle((enabled) => this.setLook(enabled))
    this.toolbar.onReset(() => this.resetWater())
    this.toolbar.onPauseToggle((paused) => this.setPaused(paused))
    document.body.appendChild(this.toolbar.element)

    this.helpOverlay = document.createElement('div')
    this.helpOverlay.style.cssText =
      'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'color:#fff;font:15px/1.8 monospace;background:rgba(0,0,0,0.75);' +
      'padding:20px 28px;border-radius:10px;pointer-events:none;white-space:pre'
    this.helpOverlay.textContent = [
      'Controls',
      '────────',
      'Pick a tool from the bar, top-left, or use the keys below.',
      '',
      'S        Spade (dig)',
      'D        Dump (pour sand)',
      'W        Water stream',
      'L        Toggle Look (independent of the tool)',
      'R        Reset water (or the Reset button)',
      'P        Pause / resume the simulation',
      'Pinch    Zoom',
      '2-finger Pan',
      '?        Toggle this help',
    ].join('\n')
    document.body.appendChild(this.helpOverlay)

    this.lookPanel = document.createElement('div')
    this.lookPanel.style.cssText =
      'display:none;position:fixed;top:12px;right:12px;color:#fff;font:14px/1.5 monospace;' +
      'background:rgba(0,0,0,0.45);padding:6px 10px;border-radius:6px;pointer-events:none;white-space:pre'
    document.body.appendChild(this.lookPanel)

    this.grid = new Grid(GRID_WIDTH, GRID_DEPTH)
    this.grid.initBeach()
    this.grid.initSpring(STREAM_RATE)
    this.bucket = new Bucket(BUCKET_CAPACITY)
    this.waterSim = new WaterSim(this.grid.width, this.grid.depth)
    this.erosion = new Erosion(this.grid.width, this.grid.depth)
    this.moisture = new Moisture(this.grid.width, this.grid.depth)
    this.slope = new Slope(this.grid.width, this.grid.depth)
    this.waves = new Waves(this.grid.width, this.grid.depth)
    this.sponge = new Sponge(this.grid.width, this.grid.depth)
    this.tide = new Tide()
    this.combinedDirty = new Uint8Array(this.grid.width * this.grid.depth)

    if (saved !== null) this.restore(saved)

    this.renderer = new Renderer(canvas)
    this.isoCamera = new IsoCamera(canvas)
    if (saved !== null) this.isoCamera.restore(saved.camera)
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
    this.picker.onHover((coord) => {
      this.hoverCell = coord
    })

    window.addEventListener('keydown', this.onKeyDown)

    this.autoSaver = new AutoSaver(store, AUTOSAVE_SECONDS, () => this.takeSnapshot())
    // Chrome only discards a tab that is already backgrounded, and
    // visibilitychange fires the moment it is - minutes before the freeze that
    // precedes a discard. That makes this the trigger that actually saves the
    // beach. pagehide and freeze are async writes against a page that may
    // already be going away, so they can only ever be best-effort, and the
    // periodic save in loop() is what covers a crash. Do not drop either in
    // favour of the other.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.autoSaver.saveNow()
    })
    window.addEventListener('pagehide', () => this.autoSaver.saveNow())
    window.addEventListener('freeze', () => this.autoSaver.saveNow())

    this.toolbar.setTool(this.toolMode)
    this.toolbar.setLook(this.lookEnabled)
    this.toolbar.setPaused(this.paused)
    this.lookPanel.style.display = this.lookEnabled ? 'block' : 'none'
    this.updateHud()
    requestAnimationFrame(this.loop)
  }

  private restore(saved: GameSnapshot): void {
    this.grid.restore(saved.grid)
    this.waterSim.restore(saved.water)
    this.waves.restore(saved.waves)
    this.tide.restore(saved.tide)
    this.bucket.fill(saved.bucket.amount)
    this.toolMode = saved.toolMode
    this.paused = saved.paused
    this.lookEnabled = saved.lookEnabled
  }

  private takeSnapshot(): GameSnapshot {
    return createSnapshot({
      grid: this.grid,
      waterSim: this.waterSim,
      waves: this.waves,
      tide: this.tide,
      bucket: this.bucket,
      camera: this.isoCamera,
      toolMode: this.toolMode,
      paused: this.paused,
      lookEnabled: this.lookEnabled,
    })
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

  private selectTool(mode: ToolMode): void {
    this.toolMode = mode
    this.toolbar.setTool(mode)
    this.updateHud()
  }

  // Pause gates the simulation only. Rendering, the camera and the tools stay
  // live: this is a sandbox, so pausing to build carefully is the point, and a
  // frozen camera would just read as a hung game.
  private setPaused(paused: boolean): void {
    this.paused = paused
    this.toolbar.setPaused(paused)
    this.updateHud()
  }

  private setLook(enabled: boolean): void {
    this.lookEnabled = enabled
    this.toolbar.setLook(enabled)
    this.lookPanel.style.display = enabled ? 'block' : 'none'
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const tool = toolForKey(e.key)
    if (tool !== null) {
      this.selectTool(tool)
    }
    if (e.key === 'r' || e.key === 'R') {
      this.resetWater()
    }
    if (e.key === '?') {
      const visible = this.helpOverlay.style.display === 'block'
      this.helpOverlay.style.display = visible ? 'none' : 'block'
    }
    if (e.key === 'p' || e.key === 'P') {
      this.setPaused(!this.paused)
    }
    if (e.key === 'l' || e.key === 'L') {
      this.setLook(!this.lookEnabled)
    }
  }

  private resetWater(): void {
    for (let z = 0; z < this.grid.seaStart; z++) {
      for (let x = 0; x < this.grid.width; x++) {
        this.grid.setWaterHeight(x, z, 0)
        this.grid.setSourceRate(x, z, 0)
      }
    }
    this.waterSim.reset()
    this.terrain.rebuildAll()
  }

  private updateHud(): void {
    const fill = `${this.bucket.amount.toFixed(1)} / ${this.bucket.capacity}`
    const wave = `wave: ${Math.ceil(this.waves.timeUntilWave)}s`
    const seaLevel = `sea level: ${(this.grid.seaLevel + this.tide.offset).toFixed(2)}`
    const state = this.paused ? '   ⏸ PAUSED' : ''
    this.toolbar.setReadouts(`bucket: ${fill}   ${wave}   ${seaLevel}${state}`)
  }

  private updateLookPanel(): void {
    if (!this.lookEnabled) return
    if (this.hoverCell === null) {
      this.lookPanel.textContent = 'Look: hover over the sand'
      return
    }
    const info = getLookInfo(this.grid, this.waterSim, this.hoverCell.x, this.hoverCell.z)
    this.lookPanel.textContent = formatLookInfo(info)
  }

  private loop = (timestamp: number): void => {
    const frameSeconds = (timestamp - this.lastTime) / 1000
    this.lastTime = timestamp

    this.autoSaver.tick(Math.min(frameSeconds, MAX_FRAME))

    const steps = this.simClock.advance(frameSeconds, this.paused)
    for (let i = 0; i < steps; i++) this.simStep(SIM_STEP)

    this.updateHud()
    this.updateLookPanel()
    // console.log('total sand height:', this.grid.getTotalSandHeight())
    this.renderer.render(this.isoCamera.camera)
    requestAnimationFrame(this.loop)
  }

  private simStep(dt: number): void {
    this.tide.step(dt)
    const seaSurface = this.grid.seaLevel + this.tide.offset
    const wavesDirty = this.waves.step(this.grid, dt, seaSurface)
    const waterDirty = this.waterSim.step(this.grid, dt)
    const spongeDirty = this.sponge.step(this.grid, this.waterSim, dt, (x, z) =>
      this.waves.surfaceAt(x, z, seaSurface))
    const erosionDirty = this.erosion.step(this.grid, this.waterSim, dt)
    const moistureDirty = this.moisture.step(this.grid, dt)
    const slopeDirty = this.slope.step(this.grid)

    orInto(
      this.combinedDirty,
      wavesDirty, waterDirty, spongeDirty, erosionDirty, moistureDirty, slopeDirty,
    )
    this.terrain.updateDirtyCells(this.combinedDirty)
  }
}
