import { describe, it, expect } from 'vitest'
import { Drying } from './Drying.ts'
import { Grid } from '../core/Grid.ts'

const DT = 1 / 30
const RESIDUAL_FILM = 1e-4

const flatGrid = (w: number, d: number, rockH = 1.0) => {
  const g = new Grid(w, d)
  for (let z = 0; z < d; z++)
    for (let x = 0; x < w; x++)
      g.setRockHeight(x, z, rockH)
  return g
}

describe('Drying', () => {
  it('dries a residual film to exactly zero', () => {
    const grid = flatGrid(1, 1)
    grid.setWaterHeight(0, 0, RESIDUAL_FILM)
    const drying = new Drying(grid.width, grid.depth)

    for (let i = 0; i < 60 / DT; i++) drying.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)!).toBe(0)
  })

  it('leaves water deep enough to be a real puddle alone', () => {
    const grid = flatGrid(1, 1)
    grid.setWaterHeight(0, 0, 1.0)
    const drying = new Drying(grid.width, grid.depth)

    for (let i = 0; i < 60 / DT; i++) drying.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)!).toBe(1.0)
  })

  it('leaves an already dry cell at zero', () => {
    const grid = flatGrid(1, 1)
    grid.setWaterHeight(0, 0, 0)
    const drying = new Drying(grid.width, grid.depth)

    for (let i = 0; i < 10; i++) drying.step(grid, DT)

    expect(grid.getWaterHeight(0, 0)!).toBe(0)
  })

  it('marks a cell that loses water dirty', () => {
    const grid = flatGrid(1, 1)
    grid.setWaterHeight(0, 0, RESIDUAL_FILM)
    const drying = new Drying(grid.width, grid.depth)

    const dirty = drying.step(grid, DT)

    expect(dirty[0]).toBe(1)
  })

  it('does not mark a cell it leaves alone dirty', () => {
    const grid = flatGrid(1, 1)
    grid.setWaterHeight(0, 0, 1.0)
    const drying = new Drying(grid.width, grid.depth)

    const dirty = drying.step(grid, DT)

    expect(dirty[0]).toBe(0)
  })

  it('stops reporting a cell dirty once it has finished drying', () => {
    const grid = flatGrid(1, 1)
    grid.setWaterHeight(0, 0, RESIDUAL_FILM)
    const drying = new Drying(grid.width, grid.depth)

    drying.step(grid, DT)
    const dirty = drying.step(grid, DT)

    expect(dirty[0]).toBe(0)
  })
})
