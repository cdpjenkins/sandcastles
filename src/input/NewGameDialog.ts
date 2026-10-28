import type { BeachSpec } from '../core/generators/BeachGenerator.ts'
import { LATEST_GENERATOR } from '../core/generators/BeachGenerator.ts'
import { beachLabel } from './beachLabel.ts'
import type { NewGameChoice } from '../core/NewGame.ts'

type ChoiceKind = NewGameChoice['kind']

const DEFAULT_CHOICE: ChoiceKind = 'random'

const CONTROL_STYLE =
  'font:inherit;color:#fff;background:rgba(255,255,255,0.08);' +
  'border:1px solid rgba(255,255,255,0.25);border-radius:4px;padding:3px 9px'

// Asks which beach a new game starts on. It only reports the choice: the
// warning that the current beach will be lost is a separate step after it,
// and a random seed is rolled by the caller, so this needs no random source.
export class NewGameDialog {
  readonly element: HTMLDivElement

  private readonly radios = new Map<ChoiceKind, HTMLInputElement>()
  private readonly restartLabel: HTMLSpanElement
  private readonly seedField: HTMLInputElement
  private readonly generatorPicker: HTMLSelectElement
  private readonly startButton: HTMLButtonElement
  private readonly latest: number
  private chooseHandler: (choice: NewGameChoice) => void = () => {}

  // `latest` is the newest generator offered: only shipped, frozen ones, so an
  // unfinished generator grows no player's beach. A parameter only so a test
  // can show the picker with more than this game has.
  constructor(latest: number = LATEST_GENERATOR) {
    this.latest = latest
    this.element = document.createElement('div')
    this.element.style.cssText =
      'position:fixed;inset:0;display:none;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.35);z-index:10;pointer-events:auto'

    const panel = document.createElement('div')
    panel.style.cssText =
      'display:flex;flex-direction:column;gap:8px;min-width:280px;' +
      'max-width:calc(100vw - 24px);box-sizing:border-box;' +
      'color:#fff;font:14px/1.4 monospace;background:rgba(0,0,0,0.75);' +
      'padding:14px 16px;border-radius:6px'
    this.element.appendChild(panel)

    const title = document.createElement('div')
    title.textContent = 'New game'
    title.style.cssText = 'font-weight:bold'
    panel.appendChild(title)

    this.addChoice(panel, 'classic', 'Classic beach')
    this.restartLabel = this.addChoice(panel, 'restart', '')
    this.addChoice(panel, 'random', 'Random beach')
    this.addChoice(panel, 'chosen', 'Choose a seed:')

    this.seedField = document.createElement('input')
    this.seedField.type = 'text'
    this.seedField.dataset.role = 'seed'
    this.seedField.placeholder = 'e.g. salty-gull-42'
    this.seedField.addEventListener('input', () => this.reflect())

    // Which generator grows a typed seed, so a seed from an older game grows
    // the beach it grew there. Random always takes the newest and a restart
    // keeps the beach's own, so it is only offered beside the seed.
    this.generatorPicker = document.createElement('select')
    this.generatorPicker.dataset.role = 'generator'
    this.generatorPicker.title = 'Which generator grows the seed'
    this.generatorPicker.style.cssText = CONTROL_STYLE
    for (let generator = latest; generator >= 1; generator--) {
      const option = document.createElement('option')
      option.value = String(generator)
      option.textContent = `gen ${generator}`
      this.generatorPicker.appendChild(option)
    }

    const seedRow = document.createElement('div')
    seedRow.style.cssText = 'display:flex;gap:6px;margin-left:22px'
    this.seedField.style.cssText = CONTROL_STYLE + ';flex:1;min-width:0'
    seedRow.append(this.seedField, this.generatorPicker)
    panel.appendChild(seedRow)

    const buttons = document.createElement('div')
    buttons.style.cssText = 'display:flex;gap:6px;justify-content:flex-end'
    panel.appendChild(buttons)
    this.addButton(buttons, 'cancel', 'Cancel', () => this.close())
    this.startButton = this.addButton(buttons, 'start', 'Start', () => this.start())

    // The game's keys listen on window, so nothing typed in here may reach
    // them: "r" would reset the water, "n" reopen this dialog, "s" pick the
    // Spade. Stopped here, at the dialog, so it holds wherever focus is inside.
    this.element.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Escape') this.close()
      if (e.key === 'Enter' && e.target === this.seedField) this.start()
    })
  }

  get isOpen(): boolean {
    return this.element.style.display !== 'none'
  }

  onChoose(handler: (choice: NewGameChoice) => void): void {
    this.chooseHandler = handler
  }

  // Opens afresh every time: a seed half-typed and cancelled is not carried
  // into the next visit.
  open(current: BeachSpec): void {
    this.restartLabel.textContent = `Restart this beach: ${beachLabel(current)}`
    this.radios.get(DEFAULT_CHOICE)!.checked = true
    this.seedField.value = ''
    this.generatorPicker.value = String(this.latest)
    this.reflect()
    this.element.style.display = 'flex'
    this.startButton.focus()
  }

  close(): void {
    this.element.style.display = 'none'
  }

  private addChoice(panel: HTMLElement, kind: ChoiceKind, text: string): HTMLSpanElement {
    const label = document.createElement('label')
    label.style.cssText = 'display:flex;gap:6px;align-items:center;cursor:pointer'
    const radio = document.createElement('input')
    radio.type = 'radio'
    radio.name = 'new-game-choice'
    radio.value = kind
    radio.addEventListener('change', () => {
      this.reflect()
      if (kind === 'chosen') this.seedField.focus()
    })
    const caption = document.createElement('span')
    caption.textContent = text
    label.append(radio, caption)
    panel.appendChild(label)
    this.radios.set(kind, radio)
    return caption
  }

  private addButton(
    parent: HTMLElement, action: string, label: string, onClick: () => void,
  ): HTMLButtonElement {
    const button = document.createElement('button')
    button.dataset.action = action
    button.textContent = label
    button.style.cssText = CONTROL_STYLE + ';cursor:pointer'
    button.addEventListener('click', onClick)
    parent.appendChild(button)
    return button
  }

  private get selected(): ChoiceKind {
    for (const [kind, radio] of this.radios) if (radio.checked) return kind
    return DEFAULT_CHOICE
  }

  private get canStart(): boolean {
    return this.selected !== 'chosen' || this.seedField.value.trim() !== ''
  }

  private reflect(): void {
    this.seedField.disabled = this.selected !== 'chosen'
    this.generatorPicker.disabled = this.selected !== 'chosen'
    this.startButton.disabled = !this.canStart
  }

  private start(): void {
    if (!this.canStart) return
    const kind = this.selected
    const choice: NewGameChoice = kind === 'chosen'
      ? { kind, text: this.seedField.value, generator: Number(this.generatorPicker.value) }
      : { kind }
    this.close()
    this.chooseHandler(choice)
  }
}
