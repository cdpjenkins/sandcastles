import { describe, it, expect } from 'vitest'
import { IsoCamera } from './IsoCamera.ts'

describe('IsoCamera snapshot', () => {
  it('restores the zoom and pan it was given', () => {
    const camera = new IsoCamera(document.createElement('canvas'))

    camera.restore({ zoom: 150, panX: 40, panZ: 90 })

    expect(camera.snapshot()).toEqual({ zoom: 150, panX: 40, panZ: 90 })
  })

  it('reports the default framing before anything is restored', () => {
    const camera = new IsoCamera(document.createElement('canvas'))

    expect(camera.snapshot()).toEqual({ zoom: 80, panX: 128, panZ: 128 })
  })
})
