import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { ensureExtension, isSupportedFile, readOpenedFile, RecentFiles, writeFileAtomic, MAX_RECENT } from '../src/main/fileService'

const dir = mkdtempSync(path.join(tmpdir(), 'pixelatelier-test-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('service de fichiers (processus principal)', () => {
  it('ajoute l’extension seulement si elle manque', () => {
    expect(ensureExtension('/a/b', 'pixatelier')).toBe('/a/b.pixatelier')
    expect(ensureExtension('/a/b.PIXATELIER', 'pixatelier')).toBe('/a/b.PIXATELIER')
    expect(ensureExtension('C:\\x\\sprite.png', 'png')).toBe('C:\\x\\sprite.png')
  })

  it('reconnaît les types de fichiers pris en charge', () => {
    expect(isSupportedFile('x.pixatelier')).toBe(true)
    expect(isSupportedFile('x.PNG')).toBe(true)
    expect(isSupportedFile('x.exe')).toBe(false)
  })

  it('écrit de façon atomique et sans laisser de fichier temporaire', async () => {
    const target = path.join(dir, 'projet.pixatelier')
    await writeFileAtomic(target, '{"a":1}')
    await writeFileAtomic(target, '{"a":2}')
    expect(readFileSync(target, 'utf8')).toBe('{"a":2}')
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('lit un projet en texte et une image en binaire', async () => {
    const proj = path.join(dir, 'lecture.pixatelier')
    writeFileSync(proj, '{"format":"x"}')
    const p = await readOpenedFile(proj)
    expect(p.kind).toBe('project')
    expect(p.text).toBe('{"format":"x"}')

    const img = path.join(dir, 'image.png')
    writeFileSync(img, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const i = await readOpenedFile(img)
    expect(i.kind).toBe('image')
    expect([...(i.bytes ?? [])]).toEqual([0x89, 0x50, 0x4e, 0x47])

    await expect(readOpenedFile(path.join(dir, 'virus.exe'))).rejects.toThrow(/non pris en charge/)
  })

  it('gère la liste des fichiers récents (ordre, doublons, limite, persistance)', async () => {
    const store = path.join(dir, 'data', 'recent.json')
    const recent = new RecentFiles(store)
    for (let i = 0; i < MAX_RECENT + 3; i++) await recent.add(`/p/${i}.pixatelier`)
    await recent.add('/p/2.pixatelier')
    const list = await recent.list()
    expect(list).toHaveLength(MAX_RECENT)
    expect(list[0]).toBe('/p/2.pixatelier')
    expect(new Set(list).size).toBe(list.length)

    const reloaded = new RecentFiles(store)
    expect(await reloaded.list()).toEqual(list)
    expect(await reloaded.has('/p/2.pixatelier')).toBe(true)
    await reloaded.remove('/p/2.pixatelier')
    expect(await reloaded.has('/p/2.pixatelier')).toBe(false)
  })
})
