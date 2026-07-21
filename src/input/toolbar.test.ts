import { describe, it, expect } from 'vitest'
import { Toolbar } from './Toolbar.ts'
import { ToolMode } from './Tools.ts'

const radios = (toolbar: Toolbar): HTMLInputElement[] =>
  Array.from(
    toolbar.element.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
  )

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
})
