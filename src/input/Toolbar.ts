import { ToolMode } from './Tools.ts'

const TOOL_LABELS: Record<ToolMode, string> = {
  [ToolMode.Spade]: '⛏ Spade',
  [ToolMode.Dump]: '🪣 Dump',
  [ToolMode.Stream]: '💧 Stream',
}

const CONTROL_STYLE =
  'font:inherit;color:#fff;background:rgba(255,255,255,0.08);' +
  'border:1px solid transparent;border-radius:4px;padding:3px 9px;' +
  'cursor:pointer;display:inline-flex;align-items:center'

const PAUSE_LABELS = { running: '⏸ Pause', paused: '▶ Resume' }

const SELECTED_BG = 'rgba(90,170,220,0.55)'
const UNSELECTED_BG = 'rgba(255,255,255,0.08)'

export class Toolbar {
  readonly element: HTMLDivElement

  private readonly radios = new Map<ToolMode, HTMLInputElement>()
  private readonly labels = new Map<ToolMode, HTMLLabelElement>()
  private readonly lookButton: HTMLButtonElement
  private readonly pauseButton: HTMLButtonElement
  private readonly exportButton: HTMLButtonElement
  private readonly readouts: HTMLSpanElement
  private readonly status: HTMLSpanElement
  private lookEnabled = false
  private paused = false
  private toolChangeHandler: (mode: ToolMode) => void = () => {}
  private lookToggleHandler: (enabled: boolean) => void = () => {}
  private resetHandler: () => void = () => {}
  private pauseToggleHandler: (paused: boolean) => void = () => {}
  private exportHandler: () => void = () => {}
  private importHandler: () => void = () => {}

  constructor() {
    this.element = document.createElement('div')
    this.element.style.cssText =
      'position:fixed;top:12px;left:12px;display:flex;gap:6px;align-items:center;' +
      'color:#fff;font:14px/1.4 monospace;background:rgba(0,0,0,0.45);' +
      'padding:6px 10px;border-radius:6px;pointer-events:auto;user-select:none;z-index:10'

    for (const mode of Object.values(ToolMode)) {
      const label = document.createElement('label')
      label.style.cssText = CONTROL_STYLE
      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = 'tool'
      radio.value = mode
      radio.style.cssText = 'position:absolute;opacity:0;width:0;height:0'
      radio.addEventListener('change', () => {
        this.markSelected(mode)
        this.toolChangeHandler(mode)
      })
      label.appendChild(radio)
      label.appendChild(document.createTextNode(TOOL_LABELS[mode]))
      this.element.appendChild(label)
      this.radios.set(mode, radio)
      this.labels.set(mode, label)
    }

    this.lookButton = this.addButton('look', '🔎 Look', () => {
      this.setLook(!this.lookEnabled)
      this.lookToggleHandler(this.lookEnabled)
    })
    this.reflectLook()

    this.pauseButton = this.addButton('pause', PAUSE_LABELS.running, () => {
      this.setPaused(!this.paused)
      this.pauseToggleHandler(this.paused)
    })
    this.reflectPaused()

    this.exportButton = this.addButton('export', '⬇ Export', () => this.exportHandler())
    this.reflectExportable()

    this.addButton('import', '⬆ Import', () => this.importHandler())
    this.addButton('reset', '↺ Reset water', () => this.resetHandler())

    this.readouts = document.createElement('span')
    this.readouts.dataset.role = 'readouts'
    this.readouts.style.cssText = 'margin-left:4px;opacity:0.85'
    this.element.appendChild(this.readouts)

    this.status = document.createElement('span')
    this.status.dataset.role = 'status'
    this.status.style.cssText = 'margin-left:4px;color:#ffd479'
    this.element.appendChild(this.status)
  }

  private addButton(action: string, label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button')
    button.dataset.action = action
    button.textContent = label
    button.style.cssText = CONTROL_STYLE
    button.addEventListener('click', onClick)
    this.element.appendChild(button)
    return button
  }

  onToolChange(handler: (mode: ToolMode) => void): void {
    this.toolChangeHandler = handler
  }

  onLookToggle(handler: (enabled: boolean) => void): void {
    this.lookToggleHandler = handler
  }

  onPauseToggle(handler: (paused: boolean) => void): void {
    this.pauseToggleHandler = handler
  }

  onExport(handler: () => void): void {
    this.exportHandler = handler
  }

  onImport(handler: () => void): void {
    this.importHandler = handler
  }

  onReset(handler: () => void): void {
    this.resetHandler = handler
  }

  setReadouts(text: string): void {
    this.readouts.textContent = text
  }

  // Its own element rather than part of the readouts: the readouts are
  // rewritten every frame, which would wipe a message before it was read.
  setStatus(text: string): void {
    this.status.textContent = text
  }

  setLook(enabled: boolean): void {
    this.lookEnabled = enabled
    this.reflectLook()
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    this.reflectPaused()
    this.reflectExportable()
  }

  setTool(mode: ToolMode): void {
    this.radios.get(mode)!.checked = true
    this.markSelected(mode)
  }

  private reflectLook(): void {
    this.lookButton.setAttribute('aria-pressed', String(this.lookEnabled))
    highlight(this.lookButton, this.lookEnabled)
  }

  private reflectPaused(): void {
    this.pauseButton.textContent = this.paused ? PAUSE_LABELS.paused : PAUSE_LABELS.running
    this.pauseButton.setAttribute('aria-pressed', String(this.paused))
    highlight(this.pauseButton, this.paused)
  }

  // A file is only offered for a still world, so the export is the beach the
  // player can see.
  private reflectExportable(): void {
    this.exportButton.disabled = !this.paused
  }

  private markSelected(mode: ToolMode): void {
    for (const [m, label] of this.labels) {
      highlight(label, m === mode)
    }
  }
}

function highlight(el: HTMLElement, selected: boolean): void {
  el.dataset.selected = String(selected)
  el.style.background = selected ? SELECTED_BG : UNSELECTED_BG
  el.style.borderColor = selected ? '#fff' : 'transparent'
}
