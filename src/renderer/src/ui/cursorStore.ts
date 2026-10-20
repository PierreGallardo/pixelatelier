import { useSyncExternalStore } from 'react'
import type { Point } from '../model/bitmap'

/**
 * Position du pointeur sur le document, séparée de l'éditeur : elle change à
 * chaque mouvement de souris et seule la barre d'état en dépend.
 */
let current: Point | null = null
const listeners = new Set<() => void>()

export function setCursor(p: Point | null): void {
  if (p === current || (p && current && p.x === current.x && p.y === current.y)) return
  current = p
  for (const fn of listeners) fn()
}

export function useCursor(): Point | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current
  )
}
