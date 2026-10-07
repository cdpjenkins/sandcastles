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
    // 'Shift' earns its place: holding shift to type 'D' fires its own keydown.
    expect(toolForKey('Shift')).toBeNull()
    expect(toolForKey('')).toBeNull()
  })

  // Game binds these inline and cannot be built under jsdom, so nothing else
  // can catch a tool quietly claiming one of them - the tool would win, since
  // selectTool and the panel toggle would both fire on the same press.
  it('leaves the keys Game binds itself free of tools', () => {
    for (const key of ['l', 'f', 'r', 'n', 'p', '?']) {
      expect(toolForKey(key)).toBeNull()
    }
  })

  it('makes every tool reachable from the keyboard', () => {
    const keys = 'abcdefghijklmnopqrstuvwxyz'.split('')
    const reachable = new Set(keys.map(toolForKey))

    for (const mode of Object.values(ToolMode)) {
      expect(reachable).toContain(mode)
    }
  })
})
