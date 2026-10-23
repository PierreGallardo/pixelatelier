import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppActions } from '../app/actions'
import { Editor } from '../editor/Editor'
import { api } from '../platform/api'
import { CanvasView } from './canvas/CanvasView'
import { buildCommands, buildKeymap, comboFromEvent, isTypingTarget, runCommand } from './commands'
import { ColorPanel } from './components/ColorPanel'
import { LayersPanel } from './components/LayersPanel'
import { MenuBar } from './components/MenuBar'
import { UpdateBanner } from './components/UpdateBanner'
import { updates } from './updateStore'
import { PalettePanel } from './components/PalettePanel'
import { StatusBar } from './components/StatusBar'
import { Timeline } from './components/Timeline'
import { Toolbar } from './components/Toolbar'
import { ToolOptionsBar } from './components/ToolOptionsBar'
import { ExportDialog } from './dialogs/ExportDialog'
import { ImageSizeDialog } from './dialogs/ImageSizeDialog'
import { AboutDialog, ShortcutsDialog } from './dialogs/InfoDialogs'
import { NewDocumentDialog } from './dialogs/NewDocumentDialog'
import { AppContext, useEditor, type AppContextValue, type DialogId } from './useEditor'
import { WelcomeScreen } from './WelcomeScreen'

/** Message temporaire (succès ou erreur) en bas à droite. */
function NoticeToast(): React.JSX.Element | null {
  const editor = useEditor()
  const notice = editor.notice
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => editor.clearNotice(notice.id), notice.kind === 'error' ? 6000 : 3500)
    return () => clearTimeout(t)
  }, [editor, notice])
  if (!notice) return null
  return (
    <div className={`toast toast--${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'} onClick={() => editor.clearNotice(notice.id)}>
      {notice.text}
    </div>
  )
}

/** Synchronise le titre de la fenêtre et l'indicateur « modifié » avec le processus principal. */
function WindowStateSync(): null {
  const editor = useEditor()
  const title = editor.title
  const dirty = editor.dirty
  const name = editor.fileName
  useEffect(() => {
    api.setWindowState({ title, dirty, documentName: name })
  }, [title, dirty, name])
  // Version navigateur : avertissement natif avant de quitter la page.
  useEffect(() => {
    if (!dirty || api.platform !== 'web') return
    const onBeforeUnload = (e: BeforeUnloadEvent): void => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])
  return null
}

function Workspace(): React.JSX.Element {
  return (
    <div className="workspace">
      <ToolOptionsBar />
      <div className="workspace__main">
        <Toolbar />
        <main className="workspace__canvas">
          <CanvasView />
        </main>
        <aside className="sidebar">
          <ColorPanel />
          <PalettePanel />
          <LayersPanel />
        </aside>
      </div>
      <Timeline />
    </div>
  )
}

function Shell({ dialog, closeDialog }: { dialog: DialogId | null; closeDialog(): void }): React.JSX.Element {
  const editor = useEditor()
  return (
    <div className="app">
      <MenuBar />
      <UpdateBanner />
      {editor.doc ? <Workspace /> : <WelcomeScreen />}
      <StatusBar />
      <NoticeToast />
      <WindowStateSync />
      {dialog === 'new' && <NewDocumentDialog onClose={closeDialog} />}
      {dialog === 'export-png' && <ExportDialog initialTab="png" onClose={closeDialog} />}
      {dialog === 'export-gif' && <ExportDialog initialTab="gif" onClose={closeDialog} />}
      {dialog === 'export-sheet' && <ExportDialog initialTab="sheet" onClose={closeDialog} />}
      {dialog === 'canvas-size' && <ImageSizeDialog mode="canvas" onClose={closeDialog} />}
      {dialog === 'scale-image' && <ImageSizeDialog mode="scale" onClose={closeDialog} />}
      {dialog === 'shortcuts' && <ShortcutsDialog onClose={closeDialog} />}
      {dialog === 'about' && <AboutDialog onClose={closeDialog} />}
    </div>
  )
}

export function App(): React.JSX.Element {
  const editor = useMemo(() => new Editor(), [])
  const actions = useMemo(() => new AppActions(editor), [editor])
  const [dialog, setDialog] = useState<DialogId | null>(null)
  const openDialog = useCallback((id: DialogId) => {
    if ((id.startsWith('export') || id === 'canvas-size' || id === 'scale-image') && !editor.doc) return
    editor.pause()
    setDialog(id)
  }, [editor])
  const closeDialog = useCallback(() => setDialog(null), [])
  const commands = useMemo(() => buildCommands(editor, actions, openDialog), [editor, actions, openDialog])
  const ctx = useMemo<AppContextValue>(() => ({ editor, actions, commands, openDialog }), [editor, actions, commands, openDialog])

  // Raccourcis clavier globaux
  useEffect(() => {
    const keymap = buildKeymap(commands)
    const onKeyDown = (e: KeyboardEvent): void => {
      if (dialog !== null || e.defaultPrevented) return
      const combo = comboFromEvent(e)
      const typing = isTypingTarget(e.target)
      // Dans un champ de saisie, seuls les raccourcis fichiers restent actifs.
      if (typing && !['mod+s', 'mod+shift+s', 'mod+o', 'mod+n'].includes(combo)) return
      const target = e.target as HTMLElement | null
      if ((combo === 'enter' || combo === 'space') && target?.closest('button, a, [role="option"]')) return
      if (target instanceof HTMLInputElement && target.type === 'range' && combo.startsWith('arrow')) return
      const id = keymap.get(combo)
      if (!id) return
      e.preventDefault()
      if (e.repeat && id.startsWith('file.')) return
      runCommand(commands[id])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commands, dialog])

  // macOS : Couper/Copier/Coller/Tout sélectionner du menu système. Dans un champ de texte,
  // l'action native est exécutée ; sinon, elle s'applique à la sélection de pixels.
  useEffect(
    () =>
      api.onMenuEdit((action) => {
        if (isTypingTarget(document.activeElement)) {
          api.nativeEdit(action)
          return
        }
        const ids = { cut: 'edit.cut', copy: 'edit.copy', paste: 'edit.paste', selectAll: 'edit.selectAll' } as const
        runCommand(commands[ids[action]])
      }),
    [commands]
  )

  // Fichier ouvert depuis le système : au démarrage, puis à chaque nouvelle demande.
  useEffect(() => {
    void actions.openPendingFile()
    return api.onOpenFileRequest(() => void actions.openPendingFile())
  }, [actions])

  // Recherche automatique d'une nouvelle version (quelques secondes après le démarrage).
  useEffect(() => {
    void updates.start((text, kind) => editor.notify(text, kind))
  }, [editor])

  // Fermeture de la fenêtre avec modifications : le processus principal demande d'enregistrer.
  useEffect(() => api.onSaveBeforeClose(() => void actions.saveAndClose()), [actions])

  // Développement uniquement : accès à l'éditeur depuis la console pour le débogage.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __pixelatelier?: unknown }).__pixelatelier = { editor, actions }
  }, [editor, actions])

  return (
    <AppContext.Provider value={ctx}>
      <Shell dialog={dialog} closeDialog={closeDialog} />
    </AppContext.Provider>
  )
}
