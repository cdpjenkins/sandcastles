import * as THREE from 'three'
import type { Grid } from '../core/Grid.ts'
import { MATERIAL_PROPS, Material } from '../core/materials.ts'
import { sandColour } from './sandColour.ts'
import { cellNoise } from './cellNoise.ts'

const JITTER = 0.06

export class TerrainMesh {
  readonly mesh: THREE.Mesh

  private readonly geometry: THREE.BufferGeometry
  private readonly positions: Float32Array
  private readonly colors: Float32Array
  private readonly grid: Grid

  constructor(grid: Grid) {
    this.grid = grid

    const W = grid.width
    const D = grid.depth
    const vertCount = W * D

    this.positions = new Float32Array(vertCount * 3)
    this.colors = new Float32Array(vertCount * 3)

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.geometry.setIndex(this.buildIndex(W, D))

    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.FrontSide,
    })

    this.mesh = new THREE.Mesh(this.geometry, material)
    this.mesh.receiveShadow = true
    this.mesh.castShadow = false

    this.rebuildAll()
  }

  private buildIndex(W: number, D: number): THREE.BufferAttribute {
    const quads = (W - 1) * (D - 1)
    const indices = new Uint32Array(quads * 6)
    let i = 0
    for (let z = 0; z < D - 1; z++) {
      for (let x = 0; x < W - 1; x++) {
        const a = z * W + x
        const b = a + 1
        const c = a + W
        const d = c + 1
        indices[i++] = a
        indices[i++] = c
        indices[i++] = b
        indices[i++] = b
        indices[i++] = c
        indices[i++] = d
      }
    }
    return new THREE.BufferAttribute(indices, 1)
  }

  private setVertex(x: number, z: number): void {
    const W = this.grid.width
    const vi = (z * W + x) * 3

    const surface = this.grid.getSurfaceHeight(x, z) ?? 0
    const water = this.grid.getWaterHeight(x, z) ?? 0
    this.positions[vi] = x
    this.positions[vi + 1] = surface + water
    this.positions[vi + 2] = z

    const moisture = this.grid.getMoisture(x, z) ?? 0
    const col =
      water > 0
        ? new THREE.Color(MATERIAL_PROPS[Material.Water].colour)
        : sandColour(moisture)
    const jitter = water > 0 ? 0 : cellNoise(x, z) * JITTER
    this.colors[vi] = Math.max(0, Math.min(1, col.r + jitter))
    this.colors[vi + 1] = Math.max(0, Math.min(1, col.g + jitter))
    this.colors[vi + 2] = Math.max(0, Math.min(1, col.b + jitter))
  }

  rebuildAll(): void {
    for (let z = 0; z < this.grid.depth; z++) {
      for (let x = 0; x < this.grid.width; x++) {
        this.setVertex(x, z)
      }
    }
    this.geometry.attributes['position'].needsUpdate = true
    this.geometry.attributes['color'].needsUpdate = true
    this.geometry.computeVertexNormals()
  }

  updateDirtyCells(dirty: Uint8Array): void {
    const W = this.grid.width
    let any = false
    for (let i = 0; i < dirty.length; i++) {
      if (dirty[i]) {
        this.setVertex(i % W, Math.floor(i / W))
        any = true
      }
    }
    if (any) {
      this.geometry.attributes['position'].needsUpdate = true
      this.geometry.attributes['color'].needsUpdate = true
      // Three.js has no partial/region normals API, so this still walks
      // every face even when only a few cells are dirty — still far
      // cheaper than rebuildAll()'s full setVertex pass over all cells.
      this.geometry.computeVertexNormals()
    }
  }

  updateDirtyRegion(x0: number, z0: number, x1: number, z1: number): void {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        this.setVertex(x, z)
      }
    }
    this.geometry.attributes['position'].needsUpdate = true
    this.geometry.attributes['color'].needsUpdate = true
    this.geometry.computeVertexNormals()
  }
}
