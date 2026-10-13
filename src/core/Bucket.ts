// Holds sand, and the water that sand was holding when it was dug: the
// bucket's capacity is sand alone, and its water travels in proportion.
export class Bucket {
  readonly capacity: number
  private _amount = 0
  private _water = 0

  constructor(capacity: number) {
    this.capacity = capacity
  }

  get amount(): number {
    return this._amount
  }

  get water(): number {
    return this._water
  }

  get isEmpty(): boolean {
    return this._amount === 0
  }

  get isFull(): boolean {
    return this._amount >= this.capacity
  }

  setAmount(n: number): void {
    this._amount = Math.max(0, Math.min(n, this.capacity))
  }

  setWater(w: number): void {
    this._water = Math.max(0, w)
  }

  // waterPerSand is how much water each unit of the sand carries in with it.
  fill(n: number, waterPerSand = 0): number {
    const added = Math.min(n, this.capacity - this._amount)
    this._amount += added
    this._water += added * waterPerSand
    return added
  }

  // The water leaves with its sand, in proportion.
  empty(n: number): number {
    const removed = Math.min(n, this._amount)
    this._water = removed === this._amount ? 0 : this._water * (1 - removed / this._amount)
    this._amount -= removed
    return removed
  }
}
