import { describe, it, expect } from 'vitest'
import { Hud } from './Hud.ts'

const readouts = (hud: Hud): HTMLElement =>
  hud.element.querySelector<HTMLElement>('[data-role="readouts"]')!

const status = (hud: Hud): HTMLElement =>
  hud.element.querySelector<HTMLElement>('[data-role="status"]')!

describe('Hud', () => {
  it('writes the readouts text', () => {
    const hud = new Hud()

    hud.setReadouts('bucket: 12.0 / 100')

    expect(readouts(hud).textContent).toBe('bucket: 12.0 / 100')
  })

  it('writes a status message', () => {
    const hud = new Hud()

    hud.setStatus('That file is not a beach')

    expect(status(hud).textContent).toBe('That file is not a beach')
  })

  // The reason these are two elements rather than one line of text: Game
  // rewrites the readouts every frame, which would wipe a message before
  // anyone could read it. This moved out of the toolbar with them.
  it('keeps a status message while the readouts are rewritten', () => {
    const hud = new Hud()
    hud.setStatus('That file is not a beach')

    hud.setReadouts('bucket: 0.0 / 1000   wave: 2s')

    expect(status(hud).textContent).toBe('That file is not a beach')
    expect(readouts(hud).textContent).toBe('bucket: 0.0 / 1000   wave: 2s')
  })

  // An empty status must take up no room, or the HUD jumps by a line the
  // first time anything is said and never settles back.
  it('takes up no line when there is no status', () => {
    const hud = new Hud()

    expect(status(hud).hidden).toBe(true)

    hud.setStatus('Beach imported')
    expect(status(hud).hidden).toBe(false)

    hud.setStatus('')
    expect(status(hud).hidden).toBe(true)
  })

  it('is one element the caller can place', () => {
    const hud = new Hud()

    expect(hud.element.tagName).toBe('DIV')
    expect(hud.element.contains(readouts(hud))).toBe(true)
    expect(hud.element.contains(status(hud))).toBe(true)
  })
})
