import { describe, it, expect } from 'vitest'
import { confirmImport } from './ImportBeach.ts'
import { toGameFile } from './GameFile.ts'
import { createSnapshot } from './GameSnapshot.ts'
import { Grid } from './Grid.ts'
import { Bucket } from './Bucket.ts'
import { WaterSim } from '../sim/WaterSim.ts'
import { Waves } from '../sim/Waves.ts'
import { Tide } from '../sim/Tide.ts'
import { IsoCamera } from '../render/IsoCamera.ts'
import { ToolMode } from '../input/Tools.ts'

const SIZE = 64
const SAVED_AT = new Date('2026-08-21T17:40:00.000Z')

function componentsHolding(sand: number, bucketed: number) {
  const components = {
    grid: new Grid(SIZE, SIZE),
    waterSim: new WaterSim(SIZE, SIZE),
    waves: new Waves(SIZE, SIZE),
    tide: new Tide(),
    bucket: new Bucket(1000),
    camera: new IsoCamera(document.createElement('canvas')),
  }
  components.grid.initBeach()
  components.grid.setSandHeight(3, 4, sand)
  components.bucket.fill(bucketed)
  return components
}

// A file of somebody else's beach, distinguishable from the one being played.
const aBeachFile = (): string =>
  JSON.stringify(toGameFile(
    createSnapshot({
      ...componentsHolding(9.5, 250),
      toolMode: ToolMode.Stream, paused: true, lookEnabled: true,
    }),
    SAVED_AT,
  ))

const alwaysAgree = () => true
const alwaysDecline = () => false

describe('confirmImport', () => {
  it('loads the beach in the file once the player agrees', () => {
    const components = componentsHolding(7.5, 120)

    const { imported } = confirmImport(components, aBeachFile(), SIZE, SIZE, alwaysAgree)

    expect(imported).not.toBeNull()
    expect(components.grid.getSandHeight(3, 4)).toBeCloseTo(9.5)
    expect(components.bucket.amount).toBeCloseTo(250)
  })

  // The whole point of asking: saying no has to leave every grain where it was.
  it('leaves the current beach untouched when the player declines', () => {
    const components = componentsHolding(7.5, 120)
    const before = components.grid.snapshot()

    confirmImport(components, aBeachFile(), SIZE, SIZE, alwaysDecline)

    expect(components.grid.snapshot()).toEqual(before)
    expect(components.bucket.amount).toBeCloseTo(120)
  })

  it('warns that the current beach is replaced and cannot be brought back', () => {
    let asked = ''

    confirmImport(componentsHolding(7.5, 120), aBeachFile(), SIZE, SIZE, (message) => {
      asked = message
      return false
    })

    expect(asked).toMatch(/cannot be undone/i)
  })

  // Reading a file the player chose is not consent to replace what they built.
  it('does not touch the beach until the player has been asked', () => {
    const components = componentsHolding(7.5, 120)
    let sandWhenAsked = 0

    confirmImport(components, aBeachFile(), SIZE, SIZE, () => {
      sandWhenAsked = components.grid.getSandHeight(3, 4)!
      return true
    })

    expect(sandWhenAsked).toBeCloseTo(7.5)
  })

  // A file that is not a beach is refused outright, so the player is never
  // asked to confirm replacing their beach with something unloadable.
  it('refuses a file that is not a beach without asking', () => {
    const components = componentsHolding(7.5, 120)
    const before = components.grid.snapshot()
    let asked = 0

    const { imported } = confirmImport(components, '{"not":"a beach"}', SIZE, SIZE, () => {
      asked++
      return true
    })

    expect(imported).toBeNull()
    expect(asked).toBe(0)
    expect(components.grid.snapshot()).toEqual(before)
  })

  it('refuses a file that is not JSON at all', () => {
    const { imported } = confirmImport(
      componentsHolding(7.5, 120), 'not json', SIZE, SIZE, alwaysAgree,
    )

    expect(imported).toBeNull()
  })

  // A rejected file and a declined import both change nothing, but they are
  // different things to say to the player, so the caller must tell them apart.
  it('tells a rejected file apart from an import the player declined', () => {
    const components = componentsHolding(7.5, 120)

    const rejected = confirmImport(components, 'not json', SIZE, SIZE, alwaysAgree)
    const declined = confirmImport(components, aBeachFile(), SIZE, SIZE, alwaysDecline)

    expect(rejected.imported).toBeNull()
    expect(declined.imported).toBeNull()
    expect(rejected.refusal).not.toBe(declined.refusal)
  })

  // The state it reports is the state the components are actually left in, so
  // the toolbar the caller reflects and the beach the autosave stores agree.
  it('reports back a state that matches the beach it loaded', () => {
    const components = componentsHolding(7.5, 120)

    const { imported } = confirmImport(components, aBeachFile(), SIZE, SIZE, alwaysAgree)

    expect(createSnapshot({
      ...components,
      toolMode: imported!.toolMode,
      paused: imported!.paused,
      lookEnabled: imported!.lookEnabled,
    })).toEqual(imported)
  })
})
