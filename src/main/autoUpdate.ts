import { app, net, shell, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC, type UpdateDownloadResult, type UpdateMode } from '../shared/api'
import { availablePath, downloadToFile } from './downloader'
import { fetchLatestRelease, pickMacInstaller } from './updates'

/**
 * Téléchargement et installation des mises à jour.
 *
 * - Windows (application installée) : electron-updater télécharge l'installateur
 *   de la dernière Release GitHub (fichier `latest.yml`), vérifie son empreinte
 *   SHA-512, puis l'installe en quittant l'application et la relance.
 * - macOS : la mise à jour intégrée exige une application signée par Apple ; on
 *   télécharge donc le DMG adapté au processeur dans « Téléchargements » et on
 *   l'ouvre, l'utilisateur n'ayant plus qu'à glisser l'application.
 * - Ailleurs (développement, Linux) : la page de la version est ouverte.
 */

let configured = false
let readyVersion: string | null = null

export function getUpdateMode(): UpdateMode {
  if (!app.isPackaged) return 'page'
  if (process.platform === 'win32') return 'install'
  if (process.platform === 'darwin') return 'download'
  return 'page'
}

function configure(getWindow: () => BrowserWindow | null): void {
  if (configured) return
  configured = true
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null
  // Source de test facultative (serveur local au format electron-updater « generic »).
  const testFeed = process.env.PIXELATELIER_UPDATE_FEED
  if (testFeed) autoUpdater.setFeedURL({ provider: 'generic', url: testFeed })
  autoUpdater.on('download-progress', (p) => {
    getWindow()?.webContents.send(IPC.updateProgress, {
      percent: Math.floor(p.percent),
      transferred: p.transferred,
      total: p.total
    })
  })
}

export async function downloadUpdate(getWindow: () => BrowserWindow | null): Promise<UpdateDownloadResult> {
  const mode = getUpdateMode()
  if (mode === 'install') {
    configure(getWindow)
    if (readyVersion) return { status: 'ready', version: readyVersion }
    const check = await autoUpdater.checkForUpdates()
    if (!check || !check.isUpdateAvailable) throw new Error('Aucune mise à jour installable n’a été trouvée pour cette version.')
    await autoUpdater.downloadUpdate()
    readyVersion = check.updateInfo.version
    return { status: 'ready', version: readyVersion }
  }
  if (mode === 'download') {
    const release = await fetchLatestRelease((url, init) => net.fetch(url, init), app.getVersion())
    const asset = pickMacInstaller(release.assets, process.arch)
    if (!asset) throw new Error('Aucun installateur macOS pour ce processeur dans la dernière version.')
    const dest = await availablePath(app.getPath('downloads'), asset.name)
    await downloadToFile(
      (url) => net.fetch(url),
      asset.url,
      dest,
      (p) => getWindow()?.webContents.send(IPC.updateProgress, p),
      asset.size
    )
    const error = await shell.openPath(dest)
    if (error) throw new Error(`Le fichier a été téléchargé dans ${dest} mais n’a pas pu être ouvert : ${error}`)
    return { status: 'opened', path: dest }
  }
  throw new Error('La mise à jour automatique n’est pas disponible sur ce système.')
}

/** Quitte l'application, installe la mise à jour téléchargée et relance Pixelatelier. */
export function installUpdate(beforeQuit: () => void): void {
  if (getUpdateMode() !== 'install' || !readyVersion) throw new Error('Aucune mise à jour prête à être installée.')
  beforeQuit()
  // Installation silencieuse (même dossier qu'avant), puis relance de l'application.
  setImmediate(() => autoUpdater.quitAndInstall(true, true))
}
