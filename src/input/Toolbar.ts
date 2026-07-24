import { ToolMode } from './Tools.ts'

const TOOL_LABELS: Record<ToolMode, string> = {
  [ToolMode.Spade]: '⛏ Spade',
  [ToolMode.Dump]: '🪣 Dump',
  [ToolMode.Stream]: '💧 Stream',
}

export class Toolbar {
  readonly element: HTMLDivElement

  private readonly radios = new Map<ToolMode, HTMLInputElement>()
  private readonly labels = new Map<ToolMode, HTMLLabelElement>()
  private readonly lookButton: HTMLButtonElement
  private readonly readouts: HTMLSpanElement
  private lookEnabled = false
  private toolChangeHandler: (mode: ToolMode) => void = () => {}
  private lookToggleHandler: (enabled: boolean) => void = () => {}
  private resetHandler: () => void = () => {}

  constructor() {
    this.element = document.createElement('div')

    for (const mode of Object.values(ToolMode)) {
      const label = document.createElement('label')
      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = 'tool'
      radio.value = mode
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

    this.lookButton = document.createElement('button')
    this.lookButton.dataset.action = 'look'
    this.lookButton.textContent = '🔎 Look'
    this.lookButton.addEventListener('click', () => {
      this.setLook(!this.lookEnabled)
      this.lookToggleHandler(this.lookEnabled)
    })
    this.reflectLook()
    this.element.appendChild(this.lookButton)

    const resetButton = document.createElement('button')
    resetButton.dataset.action = 'reset'
    resetButton.textContent = '↺ Reset water'
    resetButton.addEventListener('click', () => this.resetHandler())
    this.element.appendChild(resetButton)

    this.readouts = document.createElement('span')
    this.readouts.dataset.role = 'readouts'
    this.element.appendChild(this.readouts)
  }

  onToolChange(handler: (mode: ToolMode) => void): void {
    this.toolChangeHandler = handler
  }

  onLookToggle(handler: (enabled: boolean) => void): void {
    this.lookToggleHandler = handler
  }

  onReset(handler: () => void): void {
    this.resetHandler = handler
  }

  setReadouts(text: string): void {
    this.readouts.textContent = text
  }

  setLook(enabled: boolean): void {
    this.lookEnabled = enabled
    this.reflectLook()
  }

  private reflectLook(): void {
    this.lookButton.setAttribute('aria-pressed', String(this.lookEnabled))
    this.lookButton.dataset.selected = String(this.lookEnabled)
  }

  setTool(mode: ToolMode): void {
    this.radios.get(mode)!.checked = true
    this.markSelected(mode)
  }

  private markSelected(mode: ToolMode): void {
    for (const [m, label] of this.labels) {
      label.dataset.selected = String(m === mode)
    }
  }
}
