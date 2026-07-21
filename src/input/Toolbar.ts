import { ToolMode } from './Tools.ts'

const TOOL_LABELS: Record<ToolMode, string> = {
  [ToolMode.Spade]: '⛏ Spade',
  [ToolMode.Dump]: '🪣 Dump',
  [ToolMode.Stream]: '💧 Stream',
}

export class Toolbar {
  readonly element: HTMLDivElement

  private toolChangeHandler: (mode: ToolMode) => void = () => {}

  constructor() {
    this.element = document.createElement('div')

    for (const mode of Object.values(ToolMode)) {
      const label = document.createElement('label')
      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = 'tool'
      radio.value = mode
      radio.addEventListener('change', () => this.toolChangeHandler(mode))
      label.appendChild(radio)
      label.appendChild(document.createTextNode(TOOL_LABELS[mode]))
      this.element.appendChild(label)
    }
  }

  onToolChange(handler: (mode: ToolMode) => void): void {
    this.toolChangeHandler = handler
  }
}
