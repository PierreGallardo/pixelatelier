import { createWriteStream, promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * Téléchargement d'un fichier avec suivi de progression (sans dépendance à
 * Electron : la fonction `fetch` est injectée). Le fichier est d'abord écrit
 * sous un nom temporaire `.part`, puis renommé une fois complet : un
 * téléchargement interrompu ne laisse jamais un installateur tronqué.
 */

export interface DownloadProgress {
  transferred: number
  total: number
  percent: number
}

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean
  status: number
  headers: { get(name: string): string | null }
  body: ReadableStream<Uint8Array> | null
}>

/** Nom de fichier libre dans `dir` : « nom.dmg », sinon « nom (2).dmg », « nom (3).dmg »… */
export async function availablePath(dir: string, fileName: string): Promise<string> {
  const ext = path.extname(fileName)
  const base = fileName.slice(0, fileName.length - ext.length)
  for (let i = 1; ; i++) {
    const candidate = path.join(dir, i === 1 ? fileName : `${base} (${i})${ext}`)
    try {
      await fs.access(candidate)
    } catch {
      return candidate
    }
  }
}

export async function downloadToFile(
  fetchFn: FetchLike,
  url: string,
  dest: string,
  onProgress: (p: DownloadProgress) => void,
  expectedSize?: number
): Promise<void> {
  const res = await fetchFn(url)
  if (!res.ok || !res.body) throw new Error(`Téléchargement impossible (réponse ${res.status}).`)
  const total = Number(res.headers.get('content-length')) || expectedSize || 0
  const tmp = `${dest}.part`
  const out = createWriteStream(tmp)
  let transferred = 0
  let lastPercent = -1
  try {
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!out.write(value)) await new Promise<void>((r) => out.once('drain', () => r()))
      transferred += value.byteLength
      const percent = total > 0 ? Math.min(100, Math.floor((transferred / total) * 100)) : 0
      if (percent !== lastPercent) {
        lastPercent = percent
        onProgress({ transferred, total, percent })
      }
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())))
    if (expectedSize && transferred !== expectedSize) {
      throw new Error(`Fichier incomplet (${transferred} octets reçus sur ${expectedSize}).`)
    }
    await fs.rename(tmp, dest)
  } catch (err) {
    out.destroy()
    await fs.rm(tmp, { force: true }).catch(() => undefined)
    throw err
  }
}
