export class Bucket {
  readonly capacity: number
  private _amount = 0

  constructor(capacity: number) {
    this.capacity = capacity
  }

  get amount(): number {
    return this._amount
  }

  get isEmpty(): boolean {
    return this._amount === 0
  }

  get isFull(): boolean {
    return this._amount >= this.capacity
  }

  fill(n: number): number {
    const added = Math.min(n, this.capacity - this._amount)
    this._amount += added
    return added
  }

  empty(n: number): number {
    const removed = Math.min(n, this._amount)
    this._amount -= removed
    return removed
  }
}
