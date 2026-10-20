import { describe, expect, it } from 'vitest'
import { createBitmap, setPixel } from '../src/renderer/src/model/bitmap'
import { createDocument } from '../src/renderer/src/model/document'
import {
  parseProject,
  PROJECT_FORMAT_VERSION,
  ProjectFormatError,
  serializeProject
} from '../src/renderer/src/io/projectFormat'
import { BLUE, GREEN, RED } from './helpers'

function sampleDoc() {
  const doc = createDocument({ width: 16, height: 12, fps: 12, background: { r: 255, g: 255, b: 255, a: 255 } })
  doc.frames.push({ id: 'frame-b' })
  doc.layers[0].cels.push(createBitmap(16, 12))
  doc.layers.push({
    id: 'layer-top',
    name: 'Encre « test »',
    visible: false,
    opacity: 0.35,
    cels: [createBitmap(16, 12), createBitmap(16, 12)]
  })
  setPixel(doc.layers[0].cels[1], 3, 4, RED)
  setPixel(doc.layers[1].cels[0], 15, 11, { r: 10, g: 20, b: 30, a: 77 })
  setPixel(doc.layers[1].cels[1], 0, 0, GREEN)
  doc.palette = [RED, BLUE, { r: 1, g: 2, b: 3, a: 4 }]
  return doc
}

describe('format de projet .pixatelier', () => {
  it('enregistre puis recharge un document à l’identique', async () => {
    const doc = sampleDoc()
    const text = await serializeProject(doc)
    const loaded = await parseProject(text)

    expect(loaded.width).toBe(16)
    expect(loaded.height).toBe(12)
    expect(loaded.fps).toBe(12)
    expect(loaded.frames.map((f) => f.id)).toEqual(doc.frames.map((f) => f.id))
    expect(loaded.palette).toEqual(doc.palette)
    expect(loaded.layers).toHaveLength(2)
    loaded.layers.forEach((l, i) => {
      const src = doc.layers[i]
      expect(l.id).toBe(src.id)
      expect(l.name).toBe(src.name)
      expect(l.visible).toBe(src.visible)
      expect(l.opacity).toBe(src.opacity)
      l.cels.forEach((cel, f) => expect(cel.data).toEqual(src.cels[f].data))
    })
  })

  it('écrit un numéro de version et un identifiant de format', async () => {
    const json = JSON.parse(await serializeProject(sampleDoc()))
    expect(json.format).toBe('pixelatelier-project')
    expect(json.version).toBe(PROJECT_FORMAT_VERSION)
    // Les cellules vides sont stockées comme null pour réduire la taille du fichier.
    expect(json.layers[0].cels[1]).not.toBeNull()
    const empty = createDocument({ width: 4, height: 4 })
    expect(JSON.parse(await serializeProject(empty)).layers[0].cels[0]).toBeNull()
  })

  it('compresse efficacement les grandes images', async () => {
    const doc = createDocument({ width: 256, height: 256, background: RED })
    const text = await serializeProject(doc)
    expect(text.length).toBeLessThan(10_000) // 256 Kio bruts
  })

  it('refuse un fichier qui n’est pas un projet', async () => {
    await expect(parseProject('pas du json')).rejects.toBeInstanceOf(ProjectFormatError)
    await expect(parseProject('{"hello": 1}')).rejects.toThrow(/pas un projet/)
  })

  it('refuse un fichier d’une version future avec un message explicite', async () => {
    const json = JSON.parse(await serializeProject(sampleDoc()))
    json.version = PROJECT_FORMAT_VERSION + 1
    await expect(parseProject(JSON.stringify(json))).rejects.toThrow(/plus récent/)
  })

  it('détecte les données corrompues ou incohérentes', async () => {
    const base = JSON.parse(await serializeProject(sampleDoc()))

    const corrupt = structuredClone(base)
    corrupt.layers[0].cels[0] = 'AAAA'
    await expect(parseProject(JSON.stringify(corrupt))).rejects.toThrow(/corrompue|taille/)

    const missingCel = structuredClone(base)
    missingCel.layers[1].cels.pop()
    await expect(parseProject(JSON.stringify(missingCel))).rejects.toThrow(/une cellule par image/)

    const badSize = structuredClone(base)
    badSize.width = 0
    await expect(parseProject(JSON.stringify(badSize))).rejects.toThrow(/Dimensions/)

    const wrongSize = structuredClone(base)
    wrongSize.width = 8
    await expect(parseProject(JSON.stringify(wrongSize))).rejects.toThrow(/taille incorrecte/)
  })

  it('répare les valeurs secondaires invalides (opacité, identifiants dupliqués)', async () => {
    const json = JSON.parse(await serializeProject(sampleDoc()))
    json.layers[1].opacity = 5
    json.layers[1].id = json.layers[0].id
    json.palette.push('pas une couleur')
    const doc = await parseProject(JSON.stringify(json))
    expect(doc.layers[1].opacity).toBe(1)
    expect(doc.layers[1].id).not.toBe(doc.layers[0].id)
    expect(doc.palette).toHaveLength(3)
  })
})
