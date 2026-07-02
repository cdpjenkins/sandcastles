import * as THREE from 'three'
import { MATERIAL_PROPS, Material } from '../core/materials.ts'

const DRY = new THREE.Color(MATERIAL_PROPS[Material.Sand].colour)
const WET = new THREE.Color('#7a5c2e')

export function sandColour(moisture: number): THREE.Color {
  const t = Math.max(0, Math.min(1, moisture))
  return new THREE.Color().lerpColors(DRY, WET, t)
}
