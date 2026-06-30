import * as THREE from 'three'
import type { Grid } from '../core/Grid.ts'
import { MATERIAL_PROPS, Material } from '../core/materials.ts'

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

    const mat = water > 0 ? Material.Water : Material.Sand
    const col = new THREE.Color(MATERIAL_PROPS[mat].colour)
    this.colors[vi] = col.r
    this.colors[vi + 1] = col.g
    this.colors[vi + 2] = col.b
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
