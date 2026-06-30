import { describe, it, expect } from 'vitest'
import { Bucket } from './Bucket.ts'

describe('Bucket', () => {
  it('starts empty', () => {
    const b = new Bucket(10)
    expect(b.amount).toBe(0)
    expect(b.isEmpty).toBe(true)
    expect(b.isFull).toBe(false)
  })

  it('fill increases amount', () => {
    const b = new Bucket(10)
    b.fill(3)
    expect(b.amount).toBe(3)
  })

  it('fill clamps to capacity', () => {
    const b = new Bucket(10)
    b.fill(15)
    expect(b.amount).toBe(10)
    expect(b.isFull).toBe(true)
  })

  it('fill returns amount actually added', () => {
    const b = new Bucket(10)
    expect(b.fill(3)).toBe(3)
  })

  it('fill returns only the space remaining when nearly full', () => {
    const b = new Bucket(10)
    b.fill(8)
    expect(b.fill(5)).toBe(2)
  })

  it('empty decreases amount', () => {
    const b = new Bucket(10)
    b.fill(6)
    b.empty(2)
    expect(b.amount).toBe(4)
  })

  it('empty clamps to zero', () => {
    const b = new Bucket(10)
    b.fill(3)
    b.empty(10)
    expect(b.amount).toBe(0)
    expect(b.isEmpty).toBe(true)
  })

  it('empty returns amount actually removed', () => {
    const b = new Bucket(10)
    b.fill(3)
    expect(b.empty(2)).toBe(2)
  })

  it('empty returns only what was available when nearly empty', () => {
    const b = new Bucket(10)
    b.fill(1)
    expect(b.empty(5)).toBe(1)
  })
})
