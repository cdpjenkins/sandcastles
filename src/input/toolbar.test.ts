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
})
