import { describe, it, expect } from 'vitest'
import { confirmNewGame } from './NewGame.ts'
import { createSnapshot } from './GameSnapshot.ts'
import { Grid } from './Grid.ts'
import { Bucket } from './Bucket.ts'
import { WaterSim } from '../sim/WaterSim.ts'
import { Waves } from '../sim/Waves.ts'
import { Tide } from '../sim/Tide.ts'
import { IsoCamera } from '../render/IsoCamera.ts'
import { ToolMode } from '../input/Tools.ts'

const SIZE = 64

function aBeachMidGame() {
  const components = {
    grid: new Grid(SIZE, SIZE),
    waterSim: new WaterSim(SIZE, SIZE),
    waves: new Waves(SIZE, SIZE),
    tide: new Tide(),
    bucket: new Bucket(1000),
    camera: new IsoCamera(document.createElement('canvas')),
  }
  components.grid.initBeach()
  components.grid.setSandHeight(3, 4, 7.5)
  components.bucket.fill(120)
  return components
}

const gridOf = (c: ReturnType<typeof aBeachMidGame>) => c.grid.snapshot()

describe('confirmNewGame', () => {
  it('asks before it destroys the beach the player has been digging', () => {
    const asked: string[] = []

    confirmNewGame(aBeachMidGame(), SIZE, SIZE, (message) => {
      asked.push(message)
      return false
    })

    expect(asked).toHaveLength(1)
  })

  // The player is about to lose work with no undo, so the prompt has to say
  // that rather than ask a bare "are you sure?".
  it('warns that the beach is lost and cannot be brought back', () => {
    let asked = ''

    confirmNewGame(aBeachMidGame(), SIZE, SIZE, (message) => {
      asked = message
      return false
    })

    expect(asked).toMatch(/cannot be undone/i)
  })

  it('lays a fresh beach once the player agrees', () => {
    const components = aBeachMidGame()
    const before = gridOf(components)

    confirmNewGame(components, SIZE, SIZE, () => true)

    expect(gridOf(components)).not.toEqual(before)
    expect(components.bucket.amount).toBe(0)
  })

  // The whole point of asking: saying no has to leave every grain where it was.
  it('leaves the beach untouched when the player declines', () => {
    const components = aBeachMidGame()
    const before = gridOf(components)

    confirmNewGame(components, SIZE, SIZE, () => false)

    expect(gridOf(components)).toEqual(before)
    expect(components.bucket.amount).toBe(120)
  })

  it('reports back the state a new game starts in, so the caller can reflect it', () => {
    const started = confirmNewGame(aBeachMidGame(), SIZE, SIZE, () => true)

    expect(started).not.toBeNull()
    expect(started?.toolMode).toBe(ToolMode.Spade)
    expect(started?.paused).toBe(false)
  })

  // Distinguishable from a fresh start, so a caller that rebuilds the mesh and
  // rewrites the toolbar on the way through does neither when nothing changed.
  it('reports nothing when the player declines', () => {
    expect(confirmNewGame(aBeachMidGame(), SIZE, SIZE, () => false)).toBeNull()
  })

  // The state it reports is the state the components are actually left in, so
  // the toolbar the caller reflects and the beach the autosave stores agree.
  it('starts a game the autosave can store and the next boot can load', () => {
    const components = aBeachMidGame()

    const started = confirmNewGame(components, SIZE, SIZE, () => true)!

    expect(createSnapshot({
      ...components,
      toolMode: started.toolMode,
      paused: started.paused,
      lookEnabled: started.lookEnabled,
    })).toEqual(started)
  })
})
