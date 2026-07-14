import { describe, it, expect } from 'vitest'
import { Color } from 'three'
import { groundColour } from './groundColour.ts'
import { MATERIAL_PROPS, Material } from '../core/materials.ts'

const SAND = new Color(MATERIAL_PROPS[Material.Sand].colour)
const ROCK = new Color(MATERIAL_PROPS[Material.Rock].colour)

describe('groundColour', () => {
  it('no sand at all shows rock grey completely', () => {
    const col = groundColour(SAND, ROCK, 0)
    expect(col.getHexString()).toBe(ROCK.getHexString())
  })

  it('very thin sand is mostly sand colour with a little rock grey showing through', () => {
    const col = groundColour(SAND, ROCK, 0.3)
    const distToSand = Math.abs(col.r - SAND.r)
    const distToRock = Math.abs(col.r - ROCK.r)
    expect(distToSand).toBeLessThan(distToRock)
    expect(distToRock).toBeGreaterThan(0)
  })

  it('thick sand reads as the sand colour', () => {
    const col = groundColour(SAND, ROCK, 2)
    expect(col.getHexString()).toBe(SAND.getHexString())
  })

  it('depth beyond the opacity threshold does not extrapolate past the sand colour', () => {
    const atThreshold = groundColour(SAND, ROCK, 1)
    const beyond = groundColour(SAND, ROCK, 100)
    expect(beyond.getHexString()).toBe(atThreshold.getHexString())
  })

  it('thicker sand shows less rock grey than thinner sand', () => {
    const thin = groundColour(SAND, ROCK, 0.1)
    const thicker = groundColour(SAND, ROCK, 0.3)
    const thinDistToRock = Math.abs(thin.r - ROCK.r)
    const thickerDistToRock = Math.abs(thicker.r - ROCK.r)
    expect(thickerDistToRock).toBeGreaterThan(thinDistToRock)
  })

  it('uses the given rock colour rather than a fixed one, so moisture-darkened rock shows through', () => {
    const darkRock = new Color('#202020')
    const col = groundColour(SAND, darkRock, 0)
    expect(col.getHexString()).toBe(darkRock.getHexString())
  })
})
