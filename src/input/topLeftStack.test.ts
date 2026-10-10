import { describe, it, expect } from 'vitest'
import { stackTopLeft } from './TopLeftStack.ts'
import { Toolbar } from './Toolbar.ts'
import { Hud } from './Hud.ts'

describe('stackTopLeft', () => {
  it('puts the elements in one column, in the order given', () => {
    const toolbar = new Toolbar()
    const hud = new Hud()

    const stack = stackTopLeft(toolbar.element, hud.element)

    expect(Array.from(stack.children)).toEqual([toolbar.element, hud.element])
    expect(stack.style.position).toBe('fixed')
    expect(stack.style.flexDirection).toBe('column')
  })

  // The column is as wide as its widest child, the toolbar, so the empty
  // space beside the narrower HUD would otherwise eat clicks meant for the
  // beach underneath.
  it('lets clicks through the empty space around its children', () => {
    const stack = stackTopLeft(new Toolbar().element, new Hud().element)

    expect(stack.style.pointerEvents).toBe('none')
  })

  // The toolbar wraps, so its height is not a constant: only flow can put
  // the HUD under it. A child that fixes itself escapes the column and the
  // two overlap again.
  it('takes children that do not place themselves', () => {
    expect(new Toolbar().element.style.position).not.toBe('fixed')
    expect(new Hud().element.style.position).not.toBe('fixed')
  })

  // The toolbar is the one child that must still be clickable inside a
  // column that is not.
  it('leaves the toolbar clickable', () => {
    expect(new Toolbar().element.style.pointerEvents).toBe('auto')
  })
})
