import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type EditAction, type PixelatelierApi } from '../shared/api'

/**
 * Pont minimal et typé entre l'interface et le processus principal.
 * Chaque fonction correspond à un canal IPC précis : l'interface n'a jamais
 * accès à `ipcRenderer` ni à Node.js.
 */
const api: PixelatelierApi = {
  platform: process.platform,
  openFile: () => ipcRenderer.invoke(IPC.openFile),
  openRecent: (path) => ipcRenderer.invoke(IPC.openRecent, path),
  listRecent: () => ipcRenderer.invoke(IPC.listRecent),
  saveProject: (req) => ipcRenderer.invoke(IPC.saveProject, req),
  exportFile: (req) => ipcRenderer.invoke(IPC.exportFile, req),
  confirmDiscard: (name) => ipcRenderer.invoke(IPC.confirmDiscard, name),
  setWindowState: (state) => ipcRenderer.send(IPC.setWindowState, state),
  onSaveBeforeClose: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IPC.saveBeforeClose, listener)
    return () => {
      ipcRenderer.removeListener(IPC.saveBeforeClose, listener)
    }
  },
  closeNow: () => ipcRenderer.send(IPC.closeNow),
  writeClipboardImage: (png) => ipcRenderer.invoke(IPC.clipboardWrite, png),
  readClipboardImage: () => ipcRenderer.invoke(IPC.clipboardRead),
  onMenuEdit: (callback) => {
    const listener = (_event: unknown, action: EditAction): void => callback(action)
    ipcRenderer.on(IPC.menuEdit, listener)
    return () => {
      ipcRenderer.removeListener(IPC.menuEdit, listener)
    }
  },
  nativeEdit: (action) => ipcRenderer.send(IPC.nativeEdit, action),
  checkForUpdates: (manual) => ipcRenderer.invoke(IPC.updateCheck, manual),
  skipUpdate: (version) => ipcRenderer.invoke(IPC.updateSkip, version),
  openReleasePage: (url) => ipcRenderer.invoke(IPC.updateOpen, url),
  getUpdatePreferences: () => ipcRenderer.invoke(IPC.updateGetPreferences),
  setAutoUpdateCheck: (enabled) => ipcRenderer.invoke(IPC.updateSetAutoCheck, enabled)
}

contextBridge.exposeInMainWorld('pixelatelier', api)
