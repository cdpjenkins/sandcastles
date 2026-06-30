export interface GridCoord {
  readonly x: number
  readonly z: number
}

export interface Vec2 {
  readonly x: number
  readonly y: number
}

export interface CellColumn {
  readonly rockHeight: number
  readonly sandHeight: number
  readonly waterHeight: number
  readonly moisture: number
}
