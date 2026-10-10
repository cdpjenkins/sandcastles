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

const sourcesButton = (toolbar: Toolbar): HTMLButtonElement =>
  toolbar.element.querySelector<HTMLButtonElement>('button[data-action="sources"]')!

const sourcesPressed = (toolbar: Toolbar): boolean =>
  sourcesButton(toolbar).getAttribute('aria-pressed') === 'true'

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

  it('toggles Sources on and off, firing onSourcesToggle with the new state', () => {
    const toolbar = new Toolbar()
    const toggles: boolean[] = []
    toolbar.onSourcesToggle((visible) => toggles.push(visible))

    sourcesButton(toolbar).click()
    sourcesButton(toolbar).click()

    expect(toggles).toEqual([true, false])
  })

  it('reflects the Sources button pressed state on click', () => {
    const toolbar = new Toolbar()

    sourcesButton(toolbar).click()

    expect(sourcesPressed(toolbar)).toBe(true)
  })

  it('setSourcesVisible reflects the pressed state without firing onSourcesToggle', () => {
    const toolbar = new Toolbar()
    const toggles: boolean[] = []
    toolbar.onSourcesToggle((visible) => toggles.push(visible))

    toolbar.setSourcesVisible(true)

    expect(sourcesPressed(toolbar)).toBe(true)
    expect(toggles).toEqual([])
  })

  it('setSourcesVisible keeps the toggle in sync so the next click flips from it', () => {
    const toolbar = new Toolbar()
    const toggles: boolean[] = []

    toolbar.setSourcesVisible(true)
    toolbar.onSourcesToggle((visible) => toggles.push(visible))
    sourcesButton(toolbar).click()

    expect(toggles).toEqual([false])
  })

  // Reading where the springs are says nothing about the beach, so there is
  // nothing to gate: the panel is as useful on a frozen game as a running one.
  it('offers Sources whether the simulation is running or paused', () => {
    const toolbar = new Toolbar()

    expect(sourcesButton(toolbar).disabled).toBe(false)

    toolbar.setPaused(true)
    expect(sourcesButton(toolbar).disabled).toBe(false)
  })


  // The readouts and the status live in the Hud now. In the bar they were 49%
  // of its ~2123px width - as much as all ten controls - which is what pushed
  // its own buttons past the right edge of the screen, where a fixed bar
  // inside an overflow:hidden body makes them unclickable.
  it('holds controls only, with no text of its own to widen it', () => {
    const toolbar = new Toolbar()

    expect(toolbar.element.querySelector('[data-role="readouts"]')).toBeNull()
    expect(toolbar.element.querySelector('[data-role="status"]')).toBeNull()
  })

  // jsdom has no layout engine, so offsetWidth is always 0 and no test here
  // can prove the bar fits. What it can prove is that the rules which make
  // that impossible-to-get-wrong are still declared: a bounded width, and
  // permission to wrap. Without both, a bar wider than the screen puts its
  // own buttons where a fixed element inside an overflow:hidden body cannot
  // be clicked. The width itself stays browser-verified.
  it('is allowed to wrap, and bounded by the viewport', () => {
    const toolbar = new Toolbar()

    expect(toolbar.element.style.flexWrap).toBe('wrap')
    expect(toolbar.element.style.maxWidth).not.toBe('')
  })
})
