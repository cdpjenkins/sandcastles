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
})
