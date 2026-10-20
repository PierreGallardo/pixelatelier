import type { UpdateCheckResult } from '../shared/api'

/**
 * Détection des nouvelles versions publiées sur GitHub (sans dépendance à
 * Electron : la fonction `fetch` est injectée, ce qui rend le module testable).
 *
 * L'application ne télécharge rien elle-même : elle compare son numéro de
 * version à celui de la dernière « Release » GitHub et propose d'ouvrir la page
 * de téléchargement dans le navigateur.
 */

/** Dépôt GitHub qui publie les versions de Pixelatelier. */
export const UPDATE_REPOSITORY = 'PierreGallardo/pixelatelier'
export const RELEASES_PAGE = `https://github.com/${UPDATE_REPOSITORY}/releases`
const LATEST_RELEASE_API = `https://api.github.com/repos/${UPDATE_REPOSITORY}/releases/latest`
const REQUEST_TIMEOUT_MS = 10_000

export interface ReleaseInfo {
  version: string
  name: string
  url: string
  publishedAt: string | null
}

export interface ParsedVersion {
  major: number
  minor: number
  patch: number
  /** Identifiants de pré-version (« beta.2 » → ['beta', '2']), vide pour une version stable. */
  prerelease: string[]
}

/** Lit un numéro SemVer (« 1.2.3 », « v1.2.3 », « 1.2.3-beta.1+build ») ; `null` s'il est invalide. */
export function parseVersion(input: string): ParsedVersion | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(input.trim())
  if (!m) return null
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), prerelease: m[4] ? m[4].split('.') : [] }
}

/** Compare deux versions SemVer : négatif si a < b, 0 si égales, positif si a > b. */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a)
  const vb = parseVersion(b)
  if (!va || !vb) throw new Error(`Numéro de version invalide : ${!va ? a : b}`)
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (va[key] !== vb[key]) return va[key] - vb[key]
  }
  // Une version stable est plus récente que ses pré-versions (1.0.0 > 1.0.0-beta).
  if (va.prerelease.length === 0 || vb.prerelease.length === 0) return vb.prerelease.length - va.prerelease.length
  const n = Math.max(va.prerelease.length, vb.prerelease.length)
  for (let i = 0; i < n; i++) {
    const pa = va.prerelease[i]
    const pb = vb.prerelease[i]
    if (pa === undefined) return -1
    if (pb === undefined) return 1
    if (pa === pb) continue
    const na = /^\d+$/.test(pa)
    const nb = /^\d+$/.test(pb)
    if (na && nb) return Number(pa) - Number(pb)
    if (na !== nb) return na ? -1 : 1
    return pa < pb ? -1 : 1
  }
  return 0
}

export class NoReleaseError extends Error {
  constructor() {
    super('Aucune version n’a encore été publiée.')
    this.name = 'NoReleaseError'
  }
}

type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean
  status: number
  json(): Promise<unknown>
}>

/** Interroge GitHub et retourne la dernière version publiée (ni brouillon ni pré-version). */
export async function fetchLatestRelease(fetchFn: FetchLike, appVersion: string): Promise<ReleaseInfo> {
  const res = await fetchFn(LATEST_RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Pixelatelier/${appVersion}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (res.status === 404) throw new NoReleaseError()
  if (!res.ok) throw new Error(`GitHub a répondu ${res.status}.`)
  const data = (await res.json()) as Record<string, unknown>
  const tag = typeof data.tag_name === 'string' ? data.tag_name : ''
  if (!parseVersion(tag)) throw new Error(`Numéro de la dernière version illisible : « ${tag} ».`)
  const htmlUrl = typeof data.html_url === 'string' ? data.html_url : ''
  return {
    version: tag.replace(/^v/, ''),
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 120) : tag,
    // Seules les pages de ce dépôt peuvent être ouvertes depuis l'application.
    url: isReleaseUrl(htmlUrl) ? htmlUrl : RELEASES_PAGE,
    publishedAt: typeof data.published_at === 'string' ? data.published_at : null
  }
}

/** Vrai pour une page de version de ce dépôt (seules adresses que l'application accepte d'ouvrir). */
export function isReleaseUrl(url: string): boolean {
  return url === RELEASES_PAGE || url.startsWith(`${RELEASES_PAGE}/`)
}

/**
 * Résultat d'une vérification. Lors de la vérification automatique, une version
 * que l'utilisateur a choisi d'ignorer n'est pas signalée.
 */
export function evaluateUpdate(current: string, release: ReleaseInfo, skippedVersion: string | null, manual: boolean): UpdateCheckResult {
  if (compareVersions(release.version, current) <= 0) return { status: 'up-to-date', current, latest: release.version }
  if (!manual && skippedVersion === release.version) return { status: 'skipped', current, latest: release.version }
  return { status: 'available', current, latest: release.version, name: release.name, url: release.url, publishedAt: release.publishedAt }
}

/** Vérification complète, sans jamais lever d'exception (hors ligne, GitHub indisponible…). */
export async function checkForUpdates(
  fetchFn: FetchLike,
  current: string,
  skippedVersion: string | null,
  manual: boolean
): Promise<UpdateCheckResult> {
  try {
    const release = await fetchLatestRelease(fetchFn, current)
    return evaluateUpdate(current, release, skippedVersion, manual)
  } catch (err) {
    if (err instanceof NoReleaseError) return { status: 'up-to-date', current, latest: null }
    const offline = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError' || /fetch|network|ERR_/i.test(err.message))
    return {
      status: 'error',
      current,
      message: offline ? 'Impossible de joindre GitHub. Vérifiez votre connexion Internet.' : err instanceof Error ? err.message : String(err)
    }
  }
}
