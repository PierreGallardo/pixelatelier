/**
 * Utilitaires binaires sans dépendance : base64 et compression zlib via les
 * flux natifs `CompressionStream` / `DecompressionStream` (disponibles dans
 * Chromium/Electron et dans Node.js ≥ 18).
 */

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)))
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/** Copie dans un `ArrayBuffer` dédié (exigé par certaines API web). */
export function toArrayBufferView(bytes: Uint8Array | Uint8ClampedArray): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.byteLength)
  out.set(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  return out
}

async function pipe(bytes: Uint8Array | Uint8ClampedArray, transform: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([toArrayBufferView(bytes)]).stream().pipeThrough(transform)
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

/** Compression au format zlib (RFC 1950), celui attendu dans les blocs IDAT d'un PNG. */
export function zlibCompress(bytes: Uint8Array | Uint8ClampedArray): Promise<Uint8Array<ArrayBuffer>> {
  return pipe(bytes, new CompressionStream('deflate'))
}

export function zlibDecompress(bytes: Uint8Array | Uint8ClampedArray): Promise<Uint8Array<ArrayBuffer>> {
  return pipe(bytes, new DecompressionStream('deflate'))
}
