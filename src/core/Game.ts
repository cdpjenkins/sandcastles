import { Grid, STREAM_RATE } from './Grid.ts'
import { AutoSaver } from './AutoSaver.ts'
import { createSnapshot, applySnapshot } from './GameSnapshot.ts'
import { confirmNewGame } from './NewGame.ts'
import { confirmImport } from './ImportBeach.ts'
import { toGameFile, exportFilename, exportStatus } from './GameFile.ts'
import { downloadJson } from './downloadFile.ts'
import type { GameSnapshot } from './GameSnapshot.ts'
import type { SnapshotStore } from './SnapshotStore.ts'
import { SimClock } from './SimClock.ts'
import { Bucket } from './Bucket.ts'
import { Renderer } from '../render/Renderer.ts'
import { IsoCamera } from '../render/IsoCamera.ts'
import { TerrainMesh } from '../render/TerrainMesh.ts'
import { Picker } from '../input/Picker.ts'
import { ToolMode, dig, dump, repeatsOnHold } from '../input/Tools.ts'
import { ToolRepeater, REPEAT_HZ } from '../input/ToolRepeater.ts'
import { toolForKey } from '../input/KeyBindings.ts'
import { Toolbar } from '../input/Toolbar.ts'
import { Hud } from '../input/Hud.ts'
import { WaterSim } from '../sim/WaterSim.ts'
import { Evaporation } from '../sim/Evaporation.ts'
import { Erosion } from '../sim/Erosion.ts'
import { Moisture } from '../sim/Moisture.ts'
import { Slope } from '../sim/Slope.ts'
import { Waves } from '../sim/Waves.ts'
import { Sponge } from '../sim/Sponge.ts'
import { Tide } from '../sim/Tide.ts'
import { orInto } from '../sim/combineDirty.ts'
import { getLookInfo, formatLookInfo } from '../input/LookInfo.ts'
import { getSources, formatSourceList } from '../input/SourceList.ts'
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

export class Game {
  private readonly grid: Grid
  private readonly bucket: Bucket
  private readonly waterSim: WaterSim
  private readonly evaporation: Evaporation
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
  private readonly repeater: ToolRepeater
  private readonly toolbar: Toolbar
  private readonly hud: Hud
  private readonly autoSaver: AutoSaver
  private readonly helpOverlay: HTMLDivElement
  private readonly lookPanel: HTMLDivElement
  private readonly sourcePanel: HTMLDivElement
  private readonly fileInput: HTMLInputElement

  private toolMode: ToolMode = ToolMode.Spade
  private lastTime = 0
  private lookEnabled = false
  // Deliberately not in the snapshot, unlike lookEnabled: the panel is a
  // question the player asks about the beach, not part of the beach, so it
  // does not survive a reload and does not bump the save format.
  private sourcesVisible = false
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
    this.toolbar.onExport(() => this.exportBeach())
    this.toolbar.onImport(() => this.fileInput.click())
    this.toolbar.onNewGame(() => this.newGame())
    this.toolbar.onSourcesToggle((visible) => this.setSourcesVisible(visible))
    this.toolbar.onPauseToggle((paused) => this.setPaused(paused))
    document.body.appendChild(this.toolbar.element)

    // Bottom-left, clear of the toolbar above and the Sources panel opposite.
    this.hud = new Hud()
    document.body.appendChild(this.hud.element)

    this.helpOverlay = document.createElement('div')
    this.helpOverlay.style.cssText =
      'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'color:#fff;font:15px/1.8 monospace;background:rgba(0,0,0,0.75);' +
      'padding:20px 28px;border-radius:10px;pointer-events:none;white-space:pre'
    this.helpOverlay.textContent = [
      'Controls',
      '────────',
      'Pick a tool from the bar, top-left, or use the keys below.',
      'Click a cell to use it. Hold the button to dig or dump',
      'repeatedly, on the cell you pressed.',
      '',
      'S        Spade (dig)',
      'D        Dump (pour sand)',
      'W        Water stream',
      'L        Toggle Look (independent of the tool)',
      'F        Toggle the Sources list (find the springs)',
      'R        Reset water (or the Reset button)',
      'N        New game (asks first)',
      'P        Pause / resume the simulation',
      'Pinch    Zoom',
      '2-finger Pan',
      '?        Toggle this help',
    ].join('\n')
    document.body.appendChild(this.helpOverlay)

    this.fileInput = document.createElement('input')
    this.fileInput.type = 'file'
    this.fileInput.accept = 'application/json,.json'
    this.fileInput.style.display = 'none'
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0]
      // Cleared so that choosing the same file twice still fires a change.
      this.fileInput.value = ''
      if (file === undefined) return
      void file.text().then((text) => this.importBeach(text))
    })
    document.body.appendChild(this.fileInput)

    this.lookPanel = document.createElement('div')
    this.lookPanel.style.cssText =
      'display:none;position:fixed;top:12px;right:12px;color:#fff;font:14px/1.5 monospace;' +
      'background:rgba(0,0,0,0.45);padding:6px 10px;border-radius:6px;pointer-events:none;white-space:pre'
    document.body.appendChild(this.lookPanel)

    this.sourcePanel = document.createElement('div')
    this.sourcePanel.style.cssText =
      'display:none;position:fixed;bottom:12px;right:12px;color:#fff;font:14px/1.5 monospace;' +
      'background:rgba(0,0,0,0.45);padding:6px 10px;border-radius:6px;pointer-events:none;white-space:pre'
    document.body.appendChild(this.sourcePanel)

    this.grid = new Grid(GRID_WIDTH, GRID_DEPTH)
    this.grid.initBeach()
    this.grid.initSpring(STREAM_RATE)
    this.bucket = new Bucket(BUCKET_CAPACITY)
    this.waterSim = new WaterSim(this.grid.width, this.grid.depth)
    this.evaporation = new Evaporation(this.grid.width, this.grid.depth)
    this.erosion = new Erosion(this.grid.width, this.grid.depth)
    this.moisture = new Moisture(this.grid.width, this.grid.depth)
    this.slope = new Slope(this.grid.width, this.grid.depth)
    this.waves = new Waves(this.grid.width, this.grid.depth)
    this.sponge = new Sponge(this.grid.width, this.grid.depth)
    this.tide = new Tide()
    this.combinedDirty = new Uint8Array(this.grid.width * this.grid.depth)

    this.renderer = new Renderer(canvas)
    this.isoCamera = new IsoCamera(canvas)
    // After the camera exists and before TerrainMesh reads the grid: the mesh
    // is built from whatever the restore leaves behind.
    if (saved !== null) this.restore(saved)
    this.terrain = new TerrainMesh(this.grid)
    this.renderer.scene.add(this.terrain.mesh)

    this.picker = new Picker(
      canvas,
      this.isoCamera.camera,
      this.terrain.mesh,
      this.grid.width,
      this.grid.depth,
    )
    // The press applies the tool straight away through the repeater, which
    // owes its first application immediately; loop() spends the rest for as
    // long as the button is down.
    this.repeater = new ToolRepeater(REPEAT_HZ, MAX_FRAME)
    this.picker.onCellPick(({ x, z }) => this.onCellPress(x, z))
    this.picker.onRelease(() => this.repeater.release())
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

    this.reflectState()
    requestAnimationFrame(this.loop)
  }

  // The components that carry state across a restart. Named once so the
  // snapshot and the restore cannot drift apart over which those are.
  private get snapshotComponents() {
    return {
      grid: this.grid,
      waterSim: this.waterSim,
      waves: this.waves,
      tide: this.tide,
      bucket: this.bucket,
      camera: this.isoCamera,
    }
  }

  private restore(saved: GameSnapshot): void {
    applySnapshot(this.snapshotComponents, saved)
    this.adoptUiState(saved)
  }

  // Named once so a restore and a new game cannot drift apart over which
  // fields the UI state is made of. reflectState puts the toolbar in step.
  private adoptUiState(snapshot: GameSnapshot): void {
    this.toolMode = snapshot.toolMode
    this.paused = snapshot.paused
    this.lookEnabled = snapshot.lookEnabled
  }

  // Puts the toolbar and the panels back in step with the game's own state,
  // after a boot restore or an import.
  private reflectState(): void {
    this.toolbar.setTool(this.toolMode)
    this.toolbar.setLook(this.lookEnabled)
    this.toolbar.setPaused(this.paused)
    this.lookPanel.style.display = this.lookEnabled ? 'block' : 'none'
    this.updateHud()
  }

  // Offered on a running game: the snapshot below is synchronous, so the sim
  // cannot advance part-way through it and the file holds a single frame.
  private exportBeach(): void {
    const savedAt = new Date()
    const filename = exportFilename(savedAt)
    downloadJson(filename, JSON.stringify(toGameFile(this.takeSnapshot(), savedAt)))
    this.hud.setStatus(exportStatus(filename, savedAt))
  }

  // An imported beach arrives in whichever state it was saved in: adoptUiState
  // takes `paused` from the file along with everything else, so a file saved
  // while paused stops a running sim. That is faithful rather than a bug. It
  // used to be every file, because Export was reachable only while paused;
  // 9af657f dropped that gate, so the state is no longer a constant here.
  private importBeach(text: string): void {
    const { imported, refusal } = confirmImport(
      this.snapshotComponents, text, GRID_WIDTH, GRID_DEPTH,
      (message) => window.confirm(message),
    )
    if (imported === null) {
      this.hud.setStatus(
        refusal === 'cancelled' ? 'Import cancelled' : 'That file is not a Sandcastles beach',
      )
      return
    }

    this.adoptUiState(imported)
    this.terrain.rebuildAll()
    this.reflectState()
    this.hud.setStatus('Beach imported')
  }

  // The beach the player built is destroyed with no undo, so they are asked
  // first. Declining leaves the game exactly as it was, mesh and toolbar
  // included, which is why nothing here runs until a snapshot comes back.
  private newGame(): void {
    const started = confirmNewGame(
      this.snapshotComponents, GRID_WIDTH, GRID_DEPTH, (message) => window.confirm(message),
    )
    if (started === null) return

    this.adoptUiState(started)
    this.terrain.rebuildAll()
    this.reflectState()
    this.hud.setStatus('New beach')
  }

  private takeSnapshot(): GameSnapshot {
    return createSnapshot({
      ...this.snapshotComponents,
      toolMode: this.toolMode,
      paused: this.paused,
      lookEnabled: this.lookEnabled,
    })
  }

  private onCellPress(x: number, z: number): void {
    if (!repeatsOnHold(this.toolMode)) {
      this.applyTool(x, z)
      return
    }
    // Pinned to the cell the button went down on, so a hold drills one hole
    // rather than painting wherever the cursor wanders. press() owes the first
    // application, which loop() spends on the very next frame.
    this.repeater.press({ x, z })
  }

  private applyTool(x: number, z: number): void {
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

  // What a held button owes this frame. Driven by the frame clock rather than
  // the sim clock, so a hold keeps digging while the game is paused - which it
  // always has.
  private spendHeldTool(frameSeconds: number): void {
    const cell = this.repeater.cell
    if (cell === null) return
    const applications = this.repeater.due(frameSeconds)
    for (let i = 0; i < applications; i++) this.applyTool(cell.x, cell.z)
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
    if (e.key === 'n' || e.key === 'N') {
      this.newGame()
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
    // Not S, which the Spade has, and toolForKey lower-cases so Shift+S is
    // taken too. F is for finding the springs.
    if (e.key === 'f' || e.key === 'F') {
      this.setSourcesVisible(!this.sourcesVisible)
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
    this.hud.setReadouts(`bucket: ${fill}   ${wave}   ${seaLevel}${state}`)
  }

  private setSourcesVisible(visible: boolean): void {
    this.sourcesVisible = visible
    this.toolbar.setSourcesVisible(visible)
    this.sourcePanel.style.display = visible ? 'block' : 'none'
    this.updateSourcePanel()
  }

  // Rescanned every frame while open rather than refreshed at the five places
  // that write grid.source - the Stream tool, resetWater, an import, a new
  // game and a restore - because a list that misses one of those is wrong in
  // a way nobody would notice. Measured at 0.15ms for the full 256x256 scan
  // and format, under 1% of a 60fps frame, and only paid while it is open.
  private updateSourcePanel(): void {
    if (!this.sourcesVisible) return
    this.sourcePanel.textContent = formatSourceList(getSources(this.grid))
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
    this.spendHeldTool(frameSeconds)

    const steps = this.simClock.advance(frameSeconds, this.paused)
    for (let i = 0; i < steps; i++) this.simStep(SIM_STEP)

    this.updateHud()
    this.updateLookPanel()
    this.updateSourcePanel()
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
    const evaporationDirty = this.evaporation.step(this.grid, dt, seaSurface)
    const erosionDirty = this.erosion.step(this.grid, this.waterSim, dt)
    const moistureDirty = this.moisture.step(this.grid, dt)
    const slopeDirty = this.slope.step(this.grid)

    orInto(
      this.combinedDirty,
      wavesDirty, waterDirty, spongeDirty, evaporationDirty, erosionDirty, moistureDirty, slopeDirty,
    )
    this.terrain.updateDirtyCells(this.combinedDirty)
  }
}
