/**
 * Contrat de communication entre le processus de rendu (interface) et le
 * processus principal d'Electron. Le preload expose un objet conforme à
 * `PixelatelierApi` sous `window.pixelatelier` ; aucun accès direct à Node.js
 * n'est donné à l'interface.
 */

export const IPC = {
  openFile: 'file:open',
  openRecent: 'file:open-recent',
  listRecent: 'file:list-recent',
  saveProject: 'file:save-project',
  exportFile: 'file:export',
  confirmDiscard: 'dialog:confirm-discard',
  setWindowState: 'window:set-state',
  closeNow: 'window:close-now',
  saveBeforeClose: 'app:save-before-close',
  clipboardWrite: 'clipboard:write-image',
  clipboardRead: 'clipboard:read-image',
  menuEdit: 'menu:edit',
  nativeEdit: 'edit:native',
  updateCheck: 'update:check',
  updateSkip: 'update:skip',
  updateOpen: 'update:open-release',
  updateGetPreferences: 'update:get-preferences',
  updateSetAutoCheck: 'update:set-auto-check'
} as const

/** Résultat d'une recherche de nouvelle version. */
export type UpdateCheckResult =
  | { status: 'available'; current: string; latest: string; name: string; url: string; publishedAt: string | null }
  | { status: 'up-to-date'; current: string; latest: string | null }
  /** Nouvelle version que l'utilisateur a choisi d'ignorer (vérification automatique uniquement). */
  | { status: 'skipped'; current: string; latest: string }
  | { status: 'error'; current: string; message: string }
  /** Recherche impossible dans ce contexte (version navigateur). */
  | { status: 'unsupported'; current: string }

export interface UpdatePreferences {
  /** Rechercher une nouvelle version à chaque démarrage. */
  autoCheck: boolean
}

/** Commandes d'édition du menu système (macOS) transmises à l'interface. */
export type EditAction = 'cut' | 'copy' | 'paste' | 'selectAll'
export const EDIT_ACTIONS: readonly EditAction[] = ['cut', 'copy', 'paste', 'selectAll']

/**
 * Contenu image du presse-papiers système :
 * - `internal` : c'est l'image copiée en dernier par Pixelatelier (utiliser la copie interne, exacte) ;
 * - `external` : une image venant d'un autre logiciel (PNG fourni) ;
 * - `none` : pas d'image.
 */
export interface ClipboardImage {
  source: 'internal' | 'external' | 'none'
  png?: Uint8Array
}

export const PROJECT_EXTENSION = 'pixatelier'
export const IMAGE_EXTENSIONS = ['png', 'gif', 'jpg', 'jpeg', 'webp', 'bmp'] as const

export interface OpenedFile {
  path: string
  name: string
  kind: 'project' | 'image'
  /** Contenu d'un projet (JSON). */
  text?: string
  /** Contenu brut d'une image à importer. */
  bytes?: Uint8Array
}

export interface SaveProjectRequest {
  /** Chemin actuel ; `null` pour un document jamais enregistré. */
  path: string | null
  /** Nom proposé dans la boîte de dialogue (sans extension). */
  suggestedName: string
  content: string
  /** Forcer la boîte de dialogue « Enregistrer sous ». */
  saveAs: boolean
}

export type ExportKind = 'png' | 'gif'

export interface ExportRequest {
  kind: ExportKind
  suggestedName: string
  data: Uint8Array
  /** Fichier JSON écrit à côté (même nom, extension .json), par ex. pour une planche de sprites. */
  sidecarJson?: string
}

export interface SavedFile {
  path: string
  name: string
}

export type DiscardChoice = 'save' | 'discard' | 'cancel'

export interface WindowState {
  title: string
  dirty: boolean
  documentName: string
}

export interface PixelatelierApi {
  readonly platform: string
  openFile(): Promise<OpenedFile | null>
  openRecent(path: string): Promise<OpenedFile>
  listRecent(): Promise<string[]>
  saveProject(req: SaveProjectRequest): Promise<SavedFile | null>
  exportFile(req: ExportRequest): Promise<SavedFile | null>
  confirmDiscard(documentName: string): Promise<DiscardChoice>
  setWindowState(state: WindowState): void
  /** Le processus principal demande d'enregistrer avant de fermer la fenêtre. */
  onSaveBeforeClose(callback: () => void): () => void
  /** Ferme la fenêtre sans nouvelle confirmation (après un enregistrement réussi). */
  closeNow(): void
  /** Place une image PNG dans le presse-papiers du système. */
  writeClipboardImage(png: Uint8Array): Promise<void>
  /** Lit l'image du presse-papiers du système. */
  readClipboardImage(): Promise<ClipboardImage>
  /** Commandes Couper/Copier/Coller/Tout sélectionner du menu système (macOS). */
  onMenuEdit(callback: (action: EditAction) => void): () => void
  /** Exécute l'action d'édition native (champ de texte ayant le focus). */
  nativeEdit(action: EditAction): void
  /** Recherche une nouvelle version publiée ; `manual` = demandée par l'utilisateur. */
  checkForUpdates(manual: boolean): Promise<UpdateCheckResult>
  /** Ne plus signaler cette version lors des vérifications automatiques. */
  skipUpdate(version: string): Promise<void>
  /** Ouvre la page de téléchargement dans le navigateur. */
  openReleasePage(url: string): Promise<void>
  getUpdatePreferences(): Promise<UpdatePreferences>
  setAutoUpdateCheck(enabled: boolean): Promise<void>
}
