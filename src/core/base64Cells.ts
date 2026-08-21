// String.fromCharCode takes its bytes as arguments, so a whole layer at once
// overflows the call stack. btoa still sees one string.
const CHUNK_BYTES = 0x8000

export function encodeCells(cells: Float32Array): string {
  const bytes = new Uint8Array(cells.buffer, cells.byteOffset, cells.byteLength)
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_BYTES))
  }
  return btoa(binary)
}

// atob throws on any character outside the base64 alphabet, and a file is
// hostile input.
function decodeBase64(text: string): string | null {
  try {
    return atob(text)
  } catch {
    return null
  }
}

export function decodeCells(text: string, cells: number): Float32Array | null {
  const binary = decodeBase64(text)
  if (binary === null) return null
  if (binary.length !== cells * Float32Array.BYTES_PER_ELEMENT) return null
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new Float32Array(bytes.buffer)
}
