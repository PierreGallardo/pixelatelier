import { parseHex, type RGBA } from './color'

/** Palette par défaut de Pixelatelier (32 couleurs choisies pour ce projet). */
const DEFAULT_HEX = [
  // Neutres
  '#0f0d14', '#2b2833', '#4a4655', '#77727f', '#a9a4ae', '#d8d4d8', '#ffffff',
  // Chauds
  '#3d1a24', '#7a2a35', '#c23b3b', '#e8743b', '#f2b04c', '#f8e27a', '#fff3c4',
  // Verts
  '#1f3b2c', '#2f6b3c', '#4fa046', '#9bd25b', '#1d6f6a',
  // Bleus
  '#13213f', '#1f4b8c', '#2e86c9', '#62c4e8', '#b9ecf5',
  // Violets et roses
  '#3a2052', '#6b3d8f', '#b25bb8', '#f08cc0',
  // Bruns et carnations
  '#4a2f22', '#7b4e32', '#b27a4d', '#e3b48a'
]

export const DEFAULT_PALETTE: readonly RGBA[] = Object.freeze(
  DEFAULT_HEX.map((h) => {
    const c = parseHex(h)
    if (!c) throw new Error(`Couleur de palette invalide : ${h}`)
    return Object.freeze(c)
  })
)

export const MAX_PALETTE_SIZE = 256
