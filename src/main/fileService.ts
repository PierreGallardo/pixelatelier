import { promises as fs } from 'node:fs'
import path from 'node:path'
import { IMAGE_EXTENSIONS, PROJECT_EXTENSION, type OpenedFile } from '../shared/api'

/**
 * Accès aux fichiers pour le processus principal (sans dépendance à Electron,
 * donc testable directement avec Node.js).
 */

export const MAX_PROJECT_BYTES = 512 * 1024 * 1024
export const MAX_IMAGE_BYTES = 64 * 1024 * 1024
export const MAX_RECENT = 8

export function extensionOf(filePath: string): string {
  return path.extname(filePath).slice(1).toLowerCase()
}

export function isSupportedFile(filePath: string): boolean {
  const ext = extensionOf(filePath)
  return ext === PROJECT_EXTENSION || (IMAGE_EXTENSIONS as readonly string[]).includes(ext)
}

/**
 * Fichiers à ouvrir passés en ligne de commande (double-clic sur un fichier
 * associé, « Ouvrir avec », glisser sur l'icône sous Windows/Linux).
 * Les options (`--…`) et les arguments sans extension prise en charge sont
 * ignorés ; les chemins relatifs sont résolus depuis `cwd`.
 */
export function filesFromArgv(args: readonly string[], cwd: string): string[] {
  return args.filter((a) => a.length > 0 && !a.startsWith('-') && isSupportedFile(a)).map((a) => path.resolve(cwd, a))
}

/** Ajoute l'extension si le chemin ne la possède pas déjà (insensible à la casse). */
export function ensureExtension(filePath: string, ext: string): string {
  return extensionOf(filePath) === ext.toLowerCase() ? filePath : `${filePath}.${ext}`
}

/** Lit un projet (texte) ou une image (binaire) selon son extension. */
export async function readOpenedFile(filePath: string): Promise<OpenedFile> {
  if (!isSupportedFile(filePath)) throw new Error(`Type de fichier non pris en charge : ${path.basename(filePath)}`)
  const stat = await fs.stat(filePath).catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') throw new Error(`Le fichier « ${path.basename(filePath)} » est introuvable (déplacé ou supprimé ?).`)
    throw err
  })
  if (!stat.isFile()) throw new Error(`« ${path.basename(filePath)} » n'est pas un fichier.`)
  const isProject = extensionOf(filePath) === PROJECT_EXTENSION
  const limit = isProject ? MAX_PROJECT_BYTES : MAX_IMAGE_BYTES
  if (stat.size > limit) throw new Error(`Le fichier est trop volumineux (${Math.round(stat.size / 1048576)} Mo).`)
  const name = path.basename(filePath)
  if (isProject) return { path: filePath, name, kind: 'project', text: await fs.readFile(filePath, 'utf8') }
  const buf = await fs.readFile(filePath)
  return { path: filePath, name, kind: 'image', bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) }
}

/**
 * Écriture atomique : le contenu est écrit dans un fichier temporaire du même
 * dossier puis renommé, pour ne jamais laisser un fichier à moitié écrit.
 */
export async function writeFileAtomic(filePath: string, data: string | Uint8Array): Promise<void> {
  const dir = path.dirname(filePath)
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`)
  try {
    await fs.writeFile(tmp, data)
    await fs.rename(tmp, filePath)
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => undefined)
    throw err
  }
}

/** Préférences de l'application conservées entre deux lancements. */
export interface AppSettings {
  /** Rechercher une nouvelle version au démarrage. */
  checkUpdatesOnStartup: boolean
  /** Version que l'utilisateur a choisi d'ignorer. */
  skippedVersion: string | null
}

export const DEFAULT_SETTINGS: AppSettings = { checkUpdatesOnStartup: true, skippedVersion: null }

/** Préférences en JSON ; un fichier absent ou illisible donne les valeurs par défaut. */
export class SettingsStore {
  private cache: AppSettings | null = null

  constructor(private readonly storePath: string) {}

  async get(): Promise<AppSettings> {
    if (this.cache) return { ...this.cache }
    let raw: Record<string, unknown> = {}
    try {
      const parsed = JSON.parse(await fs.readFile(this.storePath, 'utf8'))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed
    } catch {
      // Valeurs par défaut.
    }
    this.cache = {
      checkUpdatesOnStartup: typeof raw.checkUpdatesOnStartup === 'boolean' ? raw.checkUpdatesOnStartup : DEFAULT_SETTINGS.checkUpdatesOnStartup,
      skippedVersion: typeof raw.skippedVersion === 'string' ? raw.skippedVersion.slice(0, 64) : null
    }
    return { ...this.cache }
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = { ...(await this.get()), ...patch }
    this.cache = next
    await fs.mkdir(path.dirname(this.storePath), { recursive: true })
    await writeFileAtomic(this.storePath, JSON.stringify(next, null, 2))
    return { ...next }
  }
}

/** Liste des fichiers récents, stockée en JSON dans le dossier de données de l'application. */
export class RecentFiles {
  private cache: string[] | null = null

  constructor(private readonly storePath: string) {}

  async list(): Promise<string[]> {
    if (this.cache) return [...this.cache]
    try {
      const raw = JSON.parse(await fs.readFile(this.storePath, 'utf8'))
      this.cache = Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string').slice(0, MAX_RECENT) : []
    } catch {
      this.cache = []
    }
    return [...this.cache]
  }

  async add(filePath: string): Promise<void> {
    const current = await this.list()
    const next = [filePath, ...current.filter((p) => p !== filePath)].slice(0, MAX_RECENT)
    await this.save(next)
  }

  async remove(filePath: string): Promise<void> {
    const current = await this.list()
    await this.save(current.filter((p) => p !== filePath))
  }

  async has(filePath: string): Promise<boolean> {
    return (await this.list()).includes(filePath)
  }

  private async save(list: string[]): Promise<void> {
    this.cache = list
    await fs.mkdir(path.dirname(this.storePath), { recursive: true })
    await writeFileAtomic(this.storePath, JSON.stringify(list, null, 2))
  }
}
