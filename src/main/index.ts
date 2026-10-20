import {
  app,
  BrowserWindow,
  clipboard,
  ClipboardItem,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  net,
  session,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'
import path from 'node:path'
import {
  EDIT_ACTIONS,
  IMAGE_EXTENSIONS,
  IPC,
  type ClipboardImage,
  type EditAction,
  PROJECT_EXTENSION,
  type DiscardChoice,
  type ExportRequest,
  type OpenedFile,
  type SaveProjectRequest,
  type SavedFile,
  type UpdateCheckResult,
  type UpdatePreferences,
  type WindowState
} from '../shared/api'
import { ensureExtension, readOpenedFile, RecentFiles, SettingsStore, writeFileAtomic } from './fileService'
import { checkForUpdates, isReleaseUrl, parseVersion } from './updates'

const isDev = !app.isPackaged && Boolean(process.env.ELECTRON_RENDERER_URL)

// Profil séparé hors version empaquetée : la version de développement et l'application
// installée peuvent ainsi tourner en même temps sans se disputer le cache Chromium.
if (!app.isPackaged) app.setPath('userData', `${app.getPath('userData')}-dev`)

let mainWindow: BrowserWindow | null = null
let windowState: WindowState = { title: 'Pixelatelier', dirty: false, documentName: 'Sans titre' }
let allowClose = false
let closePromptOpen = false
let quitting = false
let lastDirectory: string | null = null
let recent: RecentFiles
let settings: SettingsStore

const MAX_EXPORT_BYTES = 512 * 1024 * 1024
const MAX_CLIPBOARD_BYTES = 64 * 1024 * 1024
/** Empreinte de la dernière image placée dans le presse-papiers par l'application. */
let lastClipboardSignature: string | null = null
const MAX_PROJECT_TEXT = 1024 * 1024 * 1024

/* -------------------------------------------------------------------------- */
/*                                   Fenêtre                                  */
/* -------------------------------------------------------------------------- */

function createWindow(): void {
  allowClose = false
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    title: 'Pixelatelier',
    backgroundColor: '#14151b',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  })
  mainWindow = win

  win.once('ready-to-show', () => win.show())

  win.on('close', (event) => {
    if (allowClose || !windowState.dirty) return
    event.preventDefault()
    if (closePromptOpen) return
    closePromptOpen = true
    void dialog
      .showMessageBox(win, {
        type: 'warning',
        title: 'Modifications non enregistrées',
        message: `Enregistrer les modifications de « ${windowState.documentName} » avant de fermer ?`,
        detail: 'Les modifications non enregistrées seront perdues.',
        buttons: ['Enregistrer', 'Ne pas enregistrer', 'Annuler'],
        defaultId: 0,
        cancelId: 2,
        noLink: true
      })
      .then(({ response }) => {
        closePromptOpen = false
        if (response === 0) {
          win.webContents.send(IPC.saveBeforeClose)
        } else if (response === 1) {
          allowClose = true
          win.close()
        } else {
          quitting = false
        }
      })
  })

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
    if (quitting) app.quit()
  })

  // Outils de développement (F12) uniquement hors version empaquetée.
  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools()
    })
  }

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function buildMenu(): void {
  if (process.platform !== 'darwin') {
    // Windows et Linux : les menus sont dessinés par l'interface elle-même.
    Menu.setApplicationMenu(null)
    return
  }
  // macOS : menu système minimal. Les commandes du logiciel restent dans la barre de menus
  // de l'interface. Couper/Copier/Coller/Tout sélectionner sont transmis à l'interface, qui
  // agit sur la sélection de pixels ou sur le champ de texte ayant le focus.
  const forward = (action: EditAction) => () => mainWindow?.webContents.send(IPC.menuEdit, action)
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      {
        label: 'Édition',
        submenu: [
          { label: 'Couper', accelerator: 'CmdOrCtrl+X', click: forward('cut') },
          { label: 'Copier', accelerator: 'CmdOrCtrl+C', click: forward('copy') },
          { label: 'Coller', accelerator: 'CmdOrCtrl+V', click: forward('paste') },
          { label: 'Tout sélectionner', accelerator: 'CmdOrCtrl+A', click: forward('selectAll') }
        ]
      },
      { role: 'windowMenu' }
    ])
  )
}

/* -------------------------------------------------------------------------- */
/*                                Sécurité IPC                                */
/* -------------------------------------------------------------------------- */

/** N'accepte que les messages venant de la page principale de l'application. */
function assertTrustedSender(event: IpcMainInvokeEvent | IpcMainEvent): void {
  const url = event.senderFrame?.url ?? ''
  const devUrl = process.env.ELECTRON_RENDERER_URL
  const trusted = url.startsWith('file://') || (isDev && devUrl !== undefined && url.startsWith(devUrl))
  if (!trusted || !mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('Expéditeur IPC non autorisé')
  }
}

function sanitizeName(name: unknown, fallback: string): string {
  if (typeof name !== 'string') return fallback
  const clean = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 120)
  return clean || fallback
}

function defaultPath(fileName: string): string {
  return path.join(lastDirectory ?? app.getPath('documents'), fileName)
}

/* -------------------------------------------------------------------------- */
/*                                Gestionnaires                               */
/* -------------------------------------------------------------------------- */

async function handleOpenFile(event: IpcMainInvokeEvent): Promise<OpenedFile | null> {
  assertTrustedSender(event)
  const win = BrowserWindow.fromWebContents(event.sender)
  const options: Electron.OpenDialogOptions = {
    title: 'Ouvrir un projet ou une image',
    defaultPath: lastDirectory ?? app.getPath('documents'),
    properties: ['openFile'],
    filters: [
      { name: 'Projets et images', extensions: [PROJECT_EXTENSION, ...IMAGE_EXTENSIONS] },
      { name: 'Projet Pixelatelier', extensions: [PROJECT_EXTENSION] },
      { name: 'Images', extensions: [...IMAGE_EXTENSIONS] }
    ]
  }
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  lastDirectory = path.dirname(filePath)
  const file = await readOpenedFile(filePath)
  if (file.kind === 'project') await recent.add(filePath)
  return file
}

async function handleOpenRecent(event: IpcMainInvokeEvent, filePath: unknown): Promise<OpenedFile> {
  assertTrustedSender(event)
  // Seuls les chemins déjà présents dans la liste des fichiers récents peuvent être ouverts sans boîte de dialogue.
  if (typeof filePath !== 'string' || !(await recent.has(filePath))) throw new Error('Fichier récent inconnu.')
  try {
    const file = await readOpenedFile(filePath)
    await recent.add(filePath)
    lastDirectory = path.dirname(filePath)
    return file
  } catch (err) {
    await recent.remove(filePath)
    throw err
  }
}

async function handleSaveProject(event: IpcMainInvokeEvent, req: SaveProjectRequest): Promise<SavedFile | null> {
  assertTrustedSender(event)
  if (!req || typeof req.content !== 'string' || req.content.length > MAX_PROJECT_TEXT) throw new Error('Contenu de projet invalide.')
  let target = typeof req.path === 'string' && req.path.length > 0 && !req.saveAs ? req.path : null
  if (target && !target.toLowerCase().endsWith(`.${PROJECT_EXTENSION}`)) target = null
  if (!target) {
    const win = BrowserWindow.fromWebContents(event.sender)
    const suggested =
      typeof req.path === 'string' && req.path.toLowerCase().endsWith(`.${PROJECT_EXTENSION}`)
        ? req.path
        : defaultPath(`${sanitizeName(req.suggestedName, 'Sans titre')}.${PROJECT_EXTENSION}`)
    const options: Electron.SaveDialogOptions = {
      title: 'Enregistrer le projet',
      defaultPath: suggested,
      filters: [{ name: 'Projet Pixelatelier', extensions: [PROJECT_EXTENSION] }]
    }
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    target = ensureExtension(result.filePath, PROJECT_EXTENSION)
  }
  await writeFileAtomic(target, req.content)
  lastDirectory = path.dirname(target)
  await recent.add(target)
  return { path: target, name: path.basename(target) }
}

async function handleExport(event: IpcMainInvokeEvent, req: ExportRequest): Promise<SavedFile | null> {
  assertTrustedSender(event)
  if (!req || (req.kind !== 'png' && req.kind !== 'gif')) throw new Error("Type d'export invalide.")
  if (!(req.data instanceof Uint8Array) || req.data.byteLength === 0 || req.data.byteLength > MAX_EXPORT_BYTES) {
    throw new Error("Données d'export invalides.")
  }
  if (req.sidecarJson !== undefined && typeof req.sidecarJson !== 'string') throw new Error('Métadonnées invalides.')
  const win = BrowserWindow.fromWebContents(event.sender)
  const ext = req.kind
  const options: Electron.SaveDialogOptions = {
    title: req.kind === 'gif' ? 'Exporter l’animation en GIF' : 'Exporter en PNG',
    defaultPath: defaultPath(`${sanitizeName(req.suggestedName, 'export')}.${ext}`),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  }
  const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  const target = ensureExtension(result.filePath, ext)
  await writeFileAtomic(target, req.data)
  if (req.sidecarJson !== undefined) {
    const jsonPath = target.slice(0, target.length - ext.length - 1) + '.json'
    let text = req.sidecarJson
    try {
      // Le nom d'image référencé suit le nom réellement choisi dans la boîte de dialogue.
      const meta = JSON.parse(text)
      if (meta && typeof meta === 'object' && 'image' in meta) {
        meta.image = path.basename(target)
        text = JSON.stringify(meta, null, 2)
      }
    } catch {
      // Contenu laissé tel quel s'il ne s'agit pas d'un objet JSON.
    }
    await writeFileAtomic(jsonPath, text)
  }
  lastDirectory = path.dirname(target)
  return { path: target, name: path.basename(target) }
}

async function handleConfirmDiscard(event: IpcMainInvokeEvent, name: unknown): Promise<DiscardChoice> {
  assertTrustedSender(event)
  const win = BrowserWindow.fromWebContents(event.sender)
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    title: 'Modifications non enregistrées',
    message: `Enregistrer les modifications de « ${sanitizeName(name, 'Sans titre')} » ?`,
    detail: 'Les modifications non enregistrées seront perdues.',
    buttons: ['Enregistrer', 'Ne pas enregistrer', 'Annuler'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  }
  const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options)
  return response === 0 ? 'save' : response === 1 ? 'discard' : 'cancel'
}

/** PNG présent dans le presse-papiers du système, ou `null`. */
async function readClipboardPng(): Promise<Uint8Array | null> {
  for (const item of await clipboard.read()) {
    if (!item.types.includes('image/png')) continue
    const blob = await item.getType('image/png')
    if (blob instanceof Blob) return new Uint8Array(await blob.arrayBuffer())
  }
  return null
}

/** Empreinte (taille + FNV-1a des pixels décodés) d'une image PNG. */
function imageSignature(png: Uint8Array | null): string | null {
  if (!png) return null
  const img = nativeImage.createFromBuffer(Buffer.from(png.buffer, png.byteOffset, png.byteLength))
  if (img.isEmpty()) return null
  const { width, height } = img.getSize()
  const bmp = img.toBitmap()
  let h = 0x811c9dc5
  for (let i = 0; i < bmp.length; i++) {
    h ^= bmp[i]
    h = Math.imul(h, 0x01000193)
  }
  return `${width}x${height}:${(h >>> 0).toString(16)}`
}

async function handleClipboardWrite(event: IpcMainInvokeEvent, png: unknown): Promise<void> {
  assertTrustedSender(event)
  if (!(png instanceof Uint8Array) || png.byteLength === 0 || png.byteLength > MAX_CLIPBOARD_BYTES) {
    throw new Error('Image de presse-papiers invalide.')
  }
  if (nativeImage.createFromBuffer(Buffer.from(png.buffer, png.byteOffset, png.byteLength)).isEmpty()) {
    throw new Error('Image de presse-papiers illisible.')
  }
  await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })])
  // Relue après écriture : le système peut convertir l'image (format, profondeur).
  lastClipboardSignature = imageSignature(await readClipboardPng())
}

async function handleClipboardRead(event: IpcMainInvokeEvent): Promise<ClipboardImage> {
  assertTrustedSender(event)
  const png = await readClipboardPng()
  const signature = imageSignature(png)
  if (!png || !signature) return { source: 'none' }
  if (signature === lastClipboardSignature) return { source: 'internal' }
  return { source: 'external', png }
}

/* ------------------------------ Mises à jour ------------------------------ */

async function handleUpdateCheck(event: IpcMainInvokeEvent, manual: unknown): Promise<UpdateCheckResult> {
  assertTrustedSender(event)
  const { skippedVersion } = await settings.get()
  return checkForUpdates((url, init) => net.fetch(url, init), app.getVersion(), skippedVersion, manual === true)
}

async function handleUpdateSkip(event: IpcMainInvokeEvent, version: unknown): Promise<void> {
  assertTrustedSender(event)
  if (typeof version !== 'string' || !parseVersion(version)) throw new Error('Numéro de version invalide.')
  await settings.update({ skippedVersion: version })
}

async function handleUpdateOpen(event: IpcMainInvokeEvent, url: unknown): Promise<void> {
  assertTrustedSender(event)
  // Seules les pages de versions du dépôt officiel peuvent être ouvertes.
  if (typeof url !== 'string' || !isReleaseUrl(url)) throw new Error('Adresse de téléchargement non autorisée.')
  await shell.openExternal(url)
}

function registerIpc(): void {
  ipcMain.handle(IPC.updateCheck, handleUpdateCheck)
  ipcMain.handle(IPC.updateSkip, handleUpdateSkip)
  ipcMain.handle(IPC.updateOpen, handleUpdateOpen)
  ipcMain.handle(IPC.updateGetPreferences, async (event): Promise<UpdatePreferences> => {
    assertTrustedSender(event)
    return { autoCheck: (await settings.get()).checkUpdatesOnStartup }
  })
  ipcMain.handle(IPC.updateSetAutoCheck, async (event, enabled: unknown) => {
    assertTrustedSender(event)
    if (typeof enabled !== 'boolean') throw new Error('Valeur invalide.')
    await settings.update({ checkUpdatesOnStartup: enabled })
  })
  ipcMain.handle(IPC.clipboardWrite, handleClipboardWrite)
  ipcMain.handle(IPC.clipboardRead, handleClipboardRead)
  ipcMain.on(IPC.nativeEdit, (event, action: unknown) => {
    try {
      assertTrustedSender(event)
    } catch {
      return
    }
    if (typeof action !== 'string' || !(EDIT_ACTIONS as readonly string[]).includes(action)) return
    const wc = event.sender
    if (action === 'cut') wc.cut()
    else if (action === 'copy') wc.copy()
    else if (action === 'paste') wc.paste()
    else wc.selectAll()
  })
  ipcMain.handle(IPC.openFile, handleOpenFile)
  ipcMain.handle(IPC.openRecent, handleOpenRecent)
  ipcMain.handle(IPC.listRecent, async (event) => {
    assertTrustedSender(event)
    return recent.list()
  })
  ipcMain.handle(IPC.saveProject, handleSaveProject)
  ipcMain.handle(IPC.exportFile, handleExport)
  ipcMain.handle(IPC.confirmDiscard, handleConfirmDiscard)

  ipcMain.on(IPC.setWindowState, (event, state: WindowState) => {
    try {
      assertTrustedSender(event)
    } catch {
      return
    }
    if (!state || typeof state.title !== 'string') return
    windowState = {
      title: state.title.slice(0, 200),
      dirty: Boolean(state.dirty),
      documentName: sanitizeName(state.documentName, 'Sans titre')
    }
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.setTitle(windowState.title)
    if (process.platform === 'darwin') win?.setDocumentEdited(windowState.dirty)
  })

  ipcMain.on(IPC.closeNow, (event) => {
    try {
      assertTrustedSender(event)
    } catch {
      return
    }
    allowClose = true
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}

/* -------------------------------------------------------------------------- */
/*                                  Démarrage                                 */
/* -------------------------------------------------------------------------- */

app.on('web-contents-created', (_event, contents) => {
  // Aucune navigation ni ouverture de fenêtre depuis l'interface.
  contents.on('will-navigate', (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL
    if (!(isDev && devUrl && url.startsWith(devUrl))) event.preventDefault()
  })
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
})

app.on('before-quit', () => {
  quitting = true
})

app.whenReady().then(() => {
  recent = new RecentFiles(path.join(app.getPath('userData'), 'recent.json'))
  settings = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'))
  // Aucune permission (caméra, notifications…) n'est nécessaire.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  buildMenu()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || quitting) app.quit()
})
