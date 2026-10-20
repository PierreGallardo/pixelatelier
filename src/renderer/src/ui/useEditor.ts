import { createContext, useContext, useSyncExternalStore } from 'react'
import type { Editor } from '../editor/Editor'
import type { AppActions } from '../app/actions'
import type { CommandMap } from './commands'

export type DialogId = 'new' | 'export-png' | 'export-gif' | 'export-sheet' | 'canvas-size' | 'scale-image' | 'shortcuts' | 'about'

export interface AppContextValue {
  editor: Editor
  actions: AppActions
  commands: CommandMap
  openDialog(id: DialogId): void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('AppContext manquant')
  return ctx
}

/**
 * Abonne le composant à l'éditeur : il est rendu de nouveau à chaque
 * changement d'état (`editor.version`). Les composants lisent ensuite
 * directement les propriétés de l'éditeur.
 */
export function useEditor(): Editor {
  const { editor } = useApp()
  useSyncExternalStore(
    (cb) => editor.subscribe(cb),
    () => editor.version
  )
  return editor
}
