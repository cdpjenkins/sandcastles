import { describe, it, expect } from 'vitest'
import { Hud } from './Hud.ts'

const readouts = (hud: Hud): HTMLElement =>
  hud.element.querySelector<HTMLElement>('[data-role="readouts"]')!

const status = (hud: Hud): HTMLElement =>
  hud.element.querySelector<HTMLElement>('[data-role="status"]')!

const beach = (hud: Hud): HTMLElement =>
  hud.element.querySelector<HTMLElement>('[data-role="beach"]')!

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

  it('names the beach the player is on', () => {
    const hud = new Hud()

    hud.setSeed('salty-gull-42')
    expect(beach(hud).textContent).toBe('Beach: salty-gull-42')

    hud.setSeed(null)
    expect(beach(hud).textContent).toBe('Beach: classic')
  })

  it('keeps the beach named while the readouts are rewritten', () => {
    const hud = new Hud()
    hud.setSeed('salty-gull-42')

    hud.setReadouts('bucket: 0.0 / 1000   wave: 2s')

    expect(beach(hud).textContent).toBe('Beach: salty-gull-42')
  })

  // A seed is for sharing, so the player has to be able to select and copy it,
  // though the rest of the HUD lets clicks through to the beach. Only the
  // declaration is visible from jsdom; whether it copies is browser-checked.
  it('lets the player select the seed to copy it', () => {
    const hud = new Hud()

    expect(beach(hud).style.pointerEvents).toBe('auto')
    expect(beach(hud).style.userSelect).toBe('text')
  })

  it('is one element the caller can place', () => {
    const hud = new Hud()

    expect(hud.element.tagName).toBe('DIV')
    expect(hud.element.contains(readouts(hud))).toBe(true)
    expect(hud.element.contains(status(hud))).toBe(true)
  })
})
