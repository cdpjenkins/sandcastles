import { describe, it, expect } from 'vitest'
import { toolForKey } from './KeyBindings.ts'
import { ToolMode } from './Tools.ts'

describe('toolForKey', () => {
  it('selects the Dump tool for d', () => {
    expect(toolForKey('d')).toBe(ToolMode.Dump)
  })

  it('selects the Spade tool for s', () => {
    expect(toolForKey('s')).toBe(ToolMode.Spade)
  })

  it('selects the Stream tool for w', () => {
    expect(toolForKey('w')).toBe(ToolMode.Stream)
  })

  it('selects the same tool when the key is shifted', () => {
    expect(toolForKey('D')).toBe(ToolMode.Dump)
    expect(toolForKey('S')).toBe(ToolMode.Spade)
    expect(toolForKey('W')).toBe(ToolMode.Stream)
  })

  it('selects nothing for a key with no tool bound', () => {
    // 'Shift' earns its place: holding shift to type 'D' fires its own keydown,
    // and 'p' and 'l' are live keys that must stay out of the tool bar.
    expect(toolForKey('Shift')).toBeNull()
    expect(toolForKey('p')).toBeNull()
    expect(toolForKey('l')).toBeNull()
    expect(toolForKey('')).toBeNull()
  })

  it('makes every tool reachable from the keyboard', () => {
    const keys = 'abcdefghijklmnopqrstuvwxyz'.split('')
    const reachable = new Set(keys.map(toolForKey))

    for (const mode of Object.values(ToolMode)) {
      expect(reachable).toContain(mode)
    }
  })
})
