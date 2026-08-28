import { describe, it, expect } from 'vitest'
import { Toolbar } from './Toolbar.ts'
import { ToolMode } from './Tools.ts'

const radios = (toolbar: Toolbar): HTMLInputElement[] =>
  Array.from(
    toolbar.element.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
  )

const radioFor = (toolbar: Toolbar, mode: ToolMode): HTMLInputElement =>
  radios(toolbar).find((r) => r.value === mode)!

const clickTool = (toolbar: Toolbar, mode: ToolMode): void => {
  const radio = radioFor(toolbar, mode)
  radio.checked = true
  radio.dispatchEvent(new Event('change', { bubbles: true }))
}

const labelFor = (toolbar: Toolbar, mode: ToolMode): HTMLLabelElement =>
  radioFor(toolbar, mode).closest('label')!

const selectedModes = (toolbar: Toolbar): ToolMode[] =>
  Object.values(ToolMode).filter(
    (mode) => labelFor(toolbar, mode).dataset.selected === 'true',
  )

const lookButton = (toolbar: Toolbar): HTMLButtonElement =>
  toolbar.element.querySelector<HTMLButtonElement>('button[data-action="look"]')!

const lookPressed = (toolbar: Toolbar): boolean =>
  lookButton(toolbar).getAttribute('aria-pressed') === 'true'

const pauseButton = (toolbar: Toolbar): HTMLButtonElement =>
  toolbar.element.querySelector<HTMLButtonElement>('button[data-action="pause"]')!

const pausePressed = (toolbar: Toolbar): boolean =>
  pauseButton(toolbar).getAttribute('aria-pressed') === 'true'

const resetButton = (toolbar: Toolbar): HTMLButtonElement =>
  toolbar.element.querySelector<HTMLButtonElement>('button[data-action="reset"]')!

const exportButton = (toolbar: Toolbar): HTMLButtonElement =>
  toolbar.element.querySelector<HTMLButtonElement>('button[data-action="export"]')!

const importButton = (toolbar: Toolbar): HTMLButtonElement =>
  toolbar.element.querySelector<HTMLButtonElement>('button[data-action="import"]')!

const newGameButton = (toolbar: Toolbar): HTMLButtonElement =>
  toolbar.element.querySelector<HTMLButtonElement>('button[data-action="new-game"]')!

const status = (toolbar: Toolbar): HTMLElement =>
  toolbar.element.querySelector<HTMLElement>('[data-role="status"]')!

const readouts = (toolbar: Toolbar): HTMLElement =>
  toolbar.element.querySelector<HTMLElement>('[data-role="readouts"]')!

describe('Toolbar', () => {
  it('renders one radio per tool mode', () => {
    const toolbar = new Toolbar()
    const values = radios(toolbar).map((r) => r.value)
    expect(values).toEqual(Object.values(ToolMode))
  })

  it('groups the radios under a single name', () => {
    const toolbar = new Toolbar()
    const names = new Set(radios(toolbar).map((r) => r.name))
    expect(names.size).toBe(1)
  })

  it('fires onToolChange with the picked mode', () => {
    const toolbar = new Toolbar()
    const picked: ToolMode[] = []
    toolbar.onToolChange((mode) => picked.push(mode))

    clickTool(toolbar, ToolMode.Dump)

    expect(picked).toEqual([ToolMode.Dump])
  })

  it('selects one tool at a time', () => {
    const toolbar = new Toolbar()

    clickTool(toolbar, ToolMode.Dump)
    clickTool(toolbar, ToolMode.Stream)

    const checked = radios(toolbar).filter((r) => r.checked).map((r) => r.value)
    expect(checked).toEqual([ToolMode.Stream])
  })

  it('setTool checks the matching radio', () => {
    const toolbar = new Toolbar()

    toolbar.setTool(ToolMode.Stream)

    expect(radioFor(toolbar, ToolMode.Stream).checked).toBe(true)
  })

  it('setTool marks only the chosen tool as selected', () => {
    const toolbar = new Toolbar()

    toolbar.setTool(ToolMode.Dump)

    expect(selectedModes(toolbar)).toEqual([ToolMode.Dump])
  })

  it('setTool does not fire onToolChange', () => {
    const toolbar = new Toolbar()
    const picked: ToolMode[] = []
    toolbar.onToolChange((mode) => picked.push(mode))

    toolbar.setTool(ToolMode.Dump)

    expect(picked).toEqual([])
  })

  it('toggles Look on and off, firing onLookToggle with the new state', () => {
    const toolbar = new Toolbar()
    const toggles: boolean[] = []
    toolbar.onLookToggle((enabled) => toggles.push(enabled))

    lookButton(toolbar).click()
    lookButton(toolbar).click()

    expect(toggles).toEqual([true, false])
  })

  it('reflects the Look button pressed state on click', () => {
    const toolbar = new Toolbar()

    lookButton(toolbar).click()

    expect(lookPressed(toolbar)).toBe(true)
  })

  it('setLook reflects the pressed state without firing onLookToggle', () => {
    const toolbar = new Toolbar()
    const toggles: boolean[] = []
    toolbar.onLookToggle((enabled) => toggles.push(enabled))

    toolbar.setLook(true)

    expect(lookPressed(toolbar)).toBe(true)
    expect(toggles).toEqual([])
  })

  it('setLook keeps the toggle in sync so the next click flips from it', () => {
    const toolbar = new Toolbar()
    const toggles: boolean[] = []

    toolbar.setLook(true)
    toolbar.onLookToggle((enabled) => toggles.push(enabled))
    lookButton(toolbar).click()

    expect(toggles).toEqual([false])
  })

  it('toggles Pause on and off, firing onPauseToggle with the new state', () => {
    const toolbar = new Toolbar()
    const toggles: boolean[] = []
    toolbar.onPauseToggle((paused) => toggles.push(paused))

    pauseButton(toolbar).click()
    pauseButton(toolbar).click()

    expect(toggles).toEqual([true, false])
  })

  it('reflects the Pause button pressed state on click', () => {
    const toolbar = new Toolbar()

    pauseButton(toolbar).click()

    expect(pausePressed(toolbar)).toBe(true)
  })

  it('offers a way out of a paused game, not a second way in', () => {
    // Pause is a modal state: a frozen game with a button still reading "Pause"
    // gives the player nothing to aim at.
    const toolbar = new Toolbar()
    const running = pauseButton(toolbar).textContent

    pauseButton(toolbar).click()

    expect(pauseButton(toolbar).textContent).not.toBe(running)
  })

  it('setPaused reflects the pressed state without firing onPauseToggle', () => {
    const toolbar = new Toolbar()
    const toggles: boolean[] = []
    toolbar.onPauseToggle((paused) => toggles.push(paused))

    toolbar.setPaused(true)

    expect(pausePressed(toolbar)).toBe(true)
    expect(toggles).toEqual([])
  })

  it('setPaused keeps the toggle in sync so the next click flips from it', () => {
    const toolbar = new Toolbar()
    const toggles: boolean[] = []

    toolbar.setPaused(true)
    toolbar.onPauseToggle((paused) => toggles.push(paused))
    pauseButton(toolbar).click()

    expect(toggles).toEqual([false])
  })

  it('fires onReset when the Reset button is clicked', () => {
    const toolbar = new Toolbar()
    let resets = 0
    toolbar.onReset(() => resets++)

    resetButton(toolbar).click()

    expect(resets).toBe(1)
  })

  it('setReadouts writes the text into the readouts span', () => {
    const toolbar = new Toolbar()

    toolbar.setReadouts('bucket: 12.0 / 100')

    expect(readouts(toolbar).textContent).toBe('bucket: 12.0 / 100')
  })

  // Was once paused-only, on the belief that a running game could not be
  // snapshotted coherently. It can: the whole export path is synchronous, so
  // simStep cannot interleave with it, and AutoSaver has been snapshotting a
  // running game every 5s all along. Making the player pause bought nothing.
  it('offers Export whether the simulation is running or paused', () => {
    const toolbar = new Toolbar()

    expect(exportButton(toolbar).disabled).toBe(false)

    toolbar.setPaused(true)
    expect(exportButton(toolbar).disabled).toBe(false)

    toolbar.setPaused(false)
    expect(exportButton(toolbar).disabled).toBe(false)
  })

  it('fires onExport when Export is clicked on a running game', () => {
    const toolbar = new Toolbar()
    let exports = 0
    toolbar.onExport(() => exports++)

    exportButton(toolbar).click()

    expect(exports).toBe(1)
  })

  it('fires onExport when Export is clicked on a paused game', () => {
    const toolbar = new Toolbar()
    let exports = 0
    toolbar.onExport(() => exports++)
    toolbar.setPaused(true)

    exportButton(toolbar).click()

    expect(exports).toBe(1)
  })

  it('fires onImport when Import is clicked', () => {
    const toolbar = new Toolbar()
    let imports = 0
    toolbar.onImport(() => imports++)

    importButton(toolbar).click()

    expect(imports).toBe(1)
  })

  // Deliberately not gated the way Export is: a player who wants to load a
  // beach should not have to pause first to be allowed to.
  it('offers Import whether the simulation is running or paused', () => {
    const toolbar = new Toolbar()

    expect(importButton(toolbar).disabled).toBe(false)

    toolbar.setPaused(true)
    expect(importButton(toolbar).disabled).toBe(false)
  })

  it('fires onNewGame when New game is clicked', () => {
    const toolbar = new Toolbar()
    let starts = 0
    toolbar.onNewGame(() => starts++)

    newGameButton(toolbar).click()

    expect(starts).toBe(1)
  })

  // Not gated the way Export is: a player who has dug themselves into a beach
  // they don't want should not have to pause before being allowed to start over.
  it('offers New game whether the simulation is running or paused', () => {
    const toolbar = new Toolbar()

    expect(newGameButton(toolbar).disabled).toBe(false)

    toolbar.setPaused(true)
    expect(newGameButton(toolbar).disabled).toBe(false)
  })

  it('shows a status message', () => {
    const toolbar = new Toolbar()

    toolbar.setStatus('That file is not a beach')

    expect(status(toolbar).textContent).toBe('That file is not a beach')
  })

  // The reason the status is not part of the readouts: Game rewrites those on
  // every frame, which would wipe a message before anyone could read it.
  it('keeps a status message while the readouts are rewritten', () => {
    const toolbar = new Toolbar()
    toolbar.setStatus('That file is not a beach')

    toolbar.setReadouts('bucket: 0.0 / 1000   wave: 2s')

    expect(status(toolbar).textContent).toBe('That file is not a beach')
    expect(readouts(toolbar).textContent).toBe('bucket: 0.0 / 1000   wave: 2s')
  })
})
