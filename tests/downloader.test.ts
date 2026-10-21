import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { availablePath, downloadToFile, type DownloadProgress } from '../src/main/downloader'
import { fetchLatestRelease, pickMacInstaller, RELEASE_DOWNLOAD_PREFIX, RELEASES_PAGE } from '../src/main/updates'

const dir = mkdtempSync(path.join(tmpdir(), 'pixelatelier-dl-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

/** Réponse HTTP envoyée en plusieurs morceaux. */
function fakeResponse(bytes: Uint8Array, chunks = 4, status = 200, withLength = true) {
  const size = Math.ceil(bytes.length / chunks)
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.subarray(i, i + size))
      controller.close()
    }
  })
  return async () => ({
    ok: status === 200,
    status,
    headers: { get: (n: string) => (n === 'content-length' && withLength ? String(bytes.length) : null) },
    body
  })
}

describe('fichiers d’une version GitHub', () => {
  const assets = [
    { name: 'Pixelatelier-Setup-0.3.0.exe', browser_download_url: `${RELEASE_DOWNLOAD_PREFIX}v0.3.0/Pixelatelier-Setup-0.3.0.exe`, size: 10 },
    { name: 'Pixelatelier-0.3.0-mac-arm64.dmg', browser_download_url: `${RELEASE_DOWNLOAD_PREFIX}v0.3.0/Pixelatelier-0.3.0-mac-arm64.dmg`, size: 20 },
    { name: 'Pixelatelier-0.3.0-mac-x64.dmg', browser_download_url: `${RELEASE_DOWNLOAD_PREFIX}v0.3.0/Pixelatelier-0.3.0-mac-x64.dmg`, size: 30 },
    { name: 'piege.dmg', browser_download_url: 'https://exemple.com/piege-mac-arm64.dmg', size: 1 }
  ]
  const fetchRelease = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ tag_name: 'v0.3.0', html_url: `${RELEASES_PAGE}/tag/v0.3.0`, assets })
  })

  it('ne garde que les fichiers hébergés par le dépôt officiel', async () => {
    const info = await fetchLatestRelease(fetchRelease, '0.2.0')
    expect(info.assets.map((a) => a.name)).toEqual(['Pixelatelier-Setup-0.3.0.exe', 'Pixelatelier-0.3.0-mac-arm64.dmg', 'Pixelatelier-0.3.0-mac-x64.dmg'])
  })

  it('choisit le DMG adapté au processeur du Mac', async () => {
    const info = await fetchLatestRelease(fetchRelease, '0.2.0')
    expect(pickMacInstaller(info.assets, 'arm64')?.name).toBe('Pixelatelier-0.3.0-mac-arm64.dmg')
    expect(pickMacInstaller(info.assets, 'x64')?.name).toBe('Pixelatelier-0.3.0-mac-x64.dmg')
    expect(pickMacInstaller([], 'arm64')).toBeNull()
  })
})

describe('téléchargement vers un fichier', () => {
  const bytes = Uint8Array.from({ length: 1000 }, (_, i) => i % 251)

  it('écrit le fichier complet et signale la progression jusqu’à 100 %', async () => {
    const dest = path.join(dir, 'complet.dmg')
    const progress: DownloadProgress[] = []
    await downloadToFile(fakeResponse(bytes), 'https://x', dest, (p) => progress.push(p), bytes.length)
    expect(new Uint8Array(readFileSync(dest))).toEqual(bytes)
    expect(progress.at(-1)).toEqual({ transferred: 1000, total: 1000, percent: 100 })
    expect(progress.map((p) => p.percent)).toEqual([25, 50, 75, 100])
    expect(readdirSync(dir).some((f) => f.endsWith('.part'))).toBe(false)
  })

  it('un fichier incomplet est refusé et ne laisse rien sur le disque', async () => {
    const dest = path.join(dir, 'tronque.dmg')
    await expect(downloadToFile(fakeResponse(bytes), 'https://x', dest, () => undefined, 2000)).rejects.toThrow(/incomplet/)
    expect(readdirSync(dir).filter((f) => f.startsWith('tronque'))).toEqual([])
  })

  it('une erreur HTTP est signalée', async () => {
    await expect(downloadToFile(fakeResponse(bytes, 1, 404), 'https://x', path.join(dir, 'x.dmg'), () => undefined)).rejects.toThrow(/404/)
  })

  it('ne remplace pas un fichier existant : « nom (2).dmg »', async () => {
    writeFileSync(path.join(dir, 'doublon.dmg'), 'ancien')
    expect(await availablePath(dir, 'doublon.dmg')).toBe(path.join(dir, 'doublon (2).dmg'))
    expect(await availablePath(dir, 'nouveau.dmg')).toBe(path.join(dir, 'nouveau.dmg'))
  })
})
