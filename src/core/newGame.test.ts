import { describe, it, expect } from 'vitest'
import { confirmNewGame, resolveSeed } from './NewGame.ts'
import { createSnapshot, newGameSnapshot } from './GameSnapshot.ts'
import { randomSeed } from './BeachSeed.ts'
import { Grid } from './Grid.ts'
import { Bucket } from './Bucket.ts'
import { WaterSim } from '../sim/WaterSim.ts'
import { Waves } from '../sim/Waves.ts'
import { Tide } from '../sim/Tide.ts'
import { IsoCamera } from '../render/IsoCamera.ts'
import { ToolMode } from '../input/Tools.ts'
import { layBeachV1 } from './generators/v1/BeachGeneratorV1.ts'

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
  layBeachV1(components.grid)
  components.grid.setSandHeight(3, 4, 7.5)
  components.bucket.fill(120)
  return components
}

const gridOf = (c: ReturnType<typeof aBeachMidGame>) => c.grid.snapshot()

describe('confirmNewGame', () => {
  it('asks before it destroys the beach the player has been digging', () => {
    const asked: string[] = []

    confirmNewGame(aBeachMidGame(), SIZE, SIZE, { generator: 1, seed: null }, (message) => {
      asked.push(message)
      return false
    })

    expect(asked).toHaveLength(1)
  })

  // The player is about to lose work with no undo, so the prompt has to say
  // that rather than ask a bare "are you sure?".
  it('warns that the beach is lost and cannot be brought back', () => {
    let asked = ''

    confirmNewGame(aBeachMidGame(), SIZE, SIZE, { generator: 1, seed: null }, (message) => {
      asked = message
      return false
    })

    expect(asked).toMatch(/cannot be undone/i)
  })

  it('lays a fresh beach once the player agrees', () => {
    const components = aBeachMidGame()
    const before = gridOf(components)

    confirmNewGame(components, SIZE, SIZE, { generator: 1, seed: null }, () => true)

    expect(gridOf(components)).not.toEqual(before)
    expect(components.bucket.amount).toBe(0)
  })

  // The whole point of asking: saying no has to leave every grain where it was.
  it('leaves the beach untouched when the player declines', () => {
    const components = aBeachMidGame()
    const before = gridOf(components)

    confirmNewGame(components, SIZE, SIZE, { generator: 1, seed: null }, () => false)

    expect(gridOf(components)).toEqual(before)
    expect(components.bucket.amount).toBe(120)
  })

  it('reports back the state a new game starts in, so the caller can reflect it', () => {
    const started = confirmNewGame(aBeachMidGame(), SIZE, SIZE, { generator: 1, seed: null }, () => true)

    expect(started).not.toBeNull()
    expect(started?.toolMode).toBe(ToolMode.Spade)
    expect(started?.paused).toBe(false)
  })

  // Distinguishable from a fresh start, so a caller that rebuilds the mesh and
  // rewrites the toolbar on the way through does neither when nothing changed.
  it('reports nothing when the player declines', () => {
    expect(confirmNewGame(aBeachMidGame(), SIZE, SIZE, { generator: 1, seed: null }, () => false)).toBeNull()
  })

  // The state it reports is the state the components are actually left in, so
  // the toolbar the caller reflects and the beach the autosave stores agree.
  it('starts a game the autosave can store and the next boot can load', () => {
    const components = aBeachMidGame()

    const started = confirmNewGame(components, SIZE, SIZE, { generator: 1, seed: null }, () => true)!

    expect(createSnapshot({
      ...components,
      toolMode: started.toolMode,
      paused: started.paused,
      lookEnabled: started.lookEnabled,
      seed: started.seed,
      generator: started.generator,
    })).toEqual(started)
  })
})

describe('confirmNewGame on a seed', () => {
  it('lays the beach that seed grows', () => {
    const components = aBeachMidGame()

    confirmNewGame(components, SIZE, SIZE, { generator: 1, seed: 'salty-gull-42' }, () => true)

    expect(gridOf(components)).toEqual(newGameSnapshot(SIZE, SIZE, { generator: 1, seed: 'salty-gull-42' }).grid)
  })

  it('reports the seed, so the game knows which beach it is on', () => {
    const started = confirmNewGame(aBeachMidGame(), SIZE, SIZE, { generator: 1, seed: 'salty-gull-42' }, () => true)

    expect(started?.seed).toBe('salty-gull-42')
  })

  it('still changes nothing when the player declines', () => {
    const components = aBeachMidGame()
    const before = gridOf(components)

    expect(confirmNewGame(components, SIZE, SIZE, { generator: 1, seed: 'salty-gull-42' }, () => false)).toBeNull()
    expect(gridOf(components)).toEqual(before)
  })
})

describe('resolveSeed', () => {
  const pinned = () => 0.5

  it('is null for the classic beach', () => {
    expect(resolveSeed({ kind: 'classic' }, 'salty-gull-42', pinned)).toBeNull()
  })

  it('restarts the beach the player is on', () => {
    expect(resolveSeed({ kind: 'restart' }, 'salty-gull-42', pinned)).toBe('salty-gull-42')
  })

  // A classic beach restarted is the classic beach, not some seed for it.
  it('restarts a classic beach as classic', () => {
    expect(resolveSeed({ kind: 'restart' }, null, pinned)).toBeNull()
  })

  it('rolls a random seed from the source it is given', () => {
    expect(resolveSeed({ kind: 'random' }, null, pinned)).toBe(randomSeed(pinned))
  })

  // Stored trimmed, so the Hud shows exactly the text that was hashed.
  it('takes the player\'s own seed, trimmed', () => {
    expect(resolveSeed({ kind: 'chosen', text: '  my beach \n' }, null, pinned)).toBe('my beach')
  })
})
