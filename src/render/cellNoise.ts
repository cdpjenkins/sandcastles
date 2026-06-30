export function cellNoise(x: number, z: number): number {
  let h = (x * 374761393 + z * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = h ^ (h >>> 16)
  return (h & 0xffff) / 0x7fff - 1
}
