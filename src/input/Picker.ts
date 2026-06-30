import * as THREE from 'three'
import type { GridCoord } from '../types.ts'

export type CellPickHandler = (coord: GridCoord) => void

export class Picker {
  private readonly raycaster = new THREE.Raycaster()
  private readonly ndc = new THREE.Vector2()
  private readonly handlers: CellPickHandler[] = []
  private readonly camera: THREE.Camera
  private readonly terrain: THREE.Mesh
  private readonly gridWidth: number
  private readonly gridDepth: number

  constructor(
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    terrain: THREE.Mesh,
    gridWidth: number,
    gridDepth: number,
  ) {
    this.camera = camera
    this.terrain = terrain
    this.gridWidth = gridWidth
    this.gridDepth = gridDepth
    canvas.addEventListener('click', this.onClick)
  }

  onCellPick(handler: CellPickHandler): void {
    this.handlers.push(handler)
  }

  private onClick = (e: MouseEvent): void => {
    const canvas = e.target as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.ndc, this.camera)
    const hits = this.raycaster.intersectObject(this.terrain)
    if (hits.length === 0) return

    const point = hits[0]!.point
    const x = Math.floor(point.x)
    const z = Math.floor(point.z)

    if (x < 0 || x >= this.gridWidth || z < 0 || z >= this.gridDepth) return

    for (const h of this.handlers) h({ x, z })
  }
}
