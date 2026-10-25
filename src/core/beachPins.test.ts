import { describe, it, expect } from 'vitest'
import { newGameSnapshot, GRID_LAYERS } from './GameSnapshot.ts'

// FNV-1a over a layer's raw bytes: bit-exact, so a change in the last place of
// one cell shows.
const layerChecksum = (layer: Float32Array): string => {
  const bytes = new Uint8Array(layer.buffer, layer.byteOffset, layer.byteLength)
  let h = 0x811c9dc5
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193)
  return (h >>> 0).toString(16).padStart(8, '0')
}

const checksums = (seed: string | null): Record<string, string> => {
  const { grid } = newGameSnapshot(256, 256, seed)
  return Object.fromEntries(GRID_LAYERS.map((layer) => [layer, layerChecksum(grid[layer])]))
}

// Every layer a new game is laid out with, pinned before the generator was
// extracted into v1. v1 is frozen: a saved seed must regenerate the same beach
// forever, so if any of these fails, a beach changed - not the test.
//
// s46 places its spring far down the ridge (row 138), so the deep end of
// spring placement is pinned as well as the usual top band.
describe('The beaches a new game lays out', () => {
  it('classic', () => {
    expect(checksums(null)).toEqual({
      rock: 'e06ca45c', sand: 'cdf8f2eb', water: '9010209f',
      moisture: 'f5ec9dc5', source: '793eb518', sediment: 'f5ec9dc5',
    })
  })

  it('salty-gull-42', () => {
    expect(checksums('salty-gull-42')).toEqual({
      rock: '61982213', sand: '59bc135f', water: 'de59e98c',
      moisture: 'f5ec9dc5', source: '5fb00788', sediment: 'f5ec9dc5',
    })
  })

  it('s46', () => {
    expect(checksums('s46')).toEqual({
      rock: 'f18cb418', sand: 'b0c40432', water: 'fe038797',
      moisture: 'f5ec9dc5', source: '9b694318', sediment: 'f5ec9dc5',
    })
  })
})
