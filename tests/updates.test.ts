import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  checkForUpdates,
  compareVersions,
  evaluateUpdate,
  fetchLatestRelease,
  isReleaseUrl,
  NoReleaseError,
  parseVersion,
  RELEASES_PAGE
} from '../src/main/updates'
import { DEFAULT_SETTINGS, SettingsStore } from '../src/main/fileService'

/** Fausse fonction fetch qui renvoie une réponse GitHub fixe et mémorise la requête. */
function fakeFetch(status: number, body: unknown = {}) {
  const calls: { url: string; headers?: Record<string, string> }[] = []
  const fn = async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers })
    return { ok: status >= 200 && status < 300, status, json: async () => body }
  }
  return Object.assign(fn, { calls })
}

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  name: `Pixelatelier ${tag}`,
  html_url: `${RELEASES_PAGE}/tag/${tag}`,
  published_at: '2026-10-20T10:00:00Z',
  ...extra
})

describe('numéros de version', () => {
  it('lit les versions SemVer, avec ou sans « v »', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] })
    expect(parseVersion('v0.10.0-beta.2+build.5')).toEqual({ major: 0, minor: 10, patch: 0, prerelease: ['beta', '2'] })
    expect(parseVersion('1.2')).toBeNull()
    expect(parseVersion('version 1')).toBeNull()
  })

  it('compare correctement (numérique, pas alphabétique)', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0)
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('1.0.1', '1.1.0')).toBeLessThan(0)
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0)
  })

  it('une version stable est plus récente que ses pré-versions', () => {
    expect(compareVersions('1.0.0', '1.0.0-beta.3')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.10')).toBeLessThan(0)
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0)
    expect(compareVersions('1.0.0-beta', '1.0.0-beta.1')).toBeLessThan(0)
  })

  it('refuse un numéro invalide', () => {
    expect(() => compareVersions('abc', '1.0.0')).toThrow(/invalide/)
  })
})

describe('dernière version publiée sur GitHub', () => {
  it('interroge l’API GitHub du dépôt et lit la réponse', async () => {
    const fetch = fakeFetch(200, release('v0.2.0'))
    const info = await fetchLatestRelease(fetch, '0.1.0')
    expect(fetch.calls[0].url).toBe('https://api.github.com/repos/PierreGallardo/pixelatelier/releases/latest')
    expect(fetch.calls[0].headers?.['User-Agent']).toBe('Pixelatelier/0.1.0')
    expect(info).toEqual({ version: '0.2.0', name: 'Pixelatelier v0.2.0', url: `${RELEASES_PAGE}/tag/v0.2.0`, publishedAt: '2026-10-20T10:00:00Z' })
  })

  it('aucune version publiée (404) : erreur dédiée', async () => {
    await expect(fetchLatestRelease(fakeFetch(404), '0.1.0')).rejects.toBeInstanceOf(NoReleaseError)
  })

  it('n’accepte que les pages du dépôt officiel', async () => {
    const info = await fetchLatestRelease(fakeFetch(200, release('v0.2.0', { html_url: 'https://exemple.com/piege' })), '0.1.0')
    expect(info.url).toBe(RELEASES_PAGE)
    expect(isReleaseUrl(`${RELEASES_PAGE}/tag/v1.0.0`)).toBe(true)
    expect(isReleaseUrl('https://github.com/autre/depot/releases')).toBe(false)
    expect(isReleaseUrl(`${RELEASES_PAGE}evil`)).toBe(false)
  })

  it('refuse une étiquette illisible', async () => {
    await expect(fetchLatestRelease(fakeFetch(200, release('derniere')), '0.1.0')).rejects.toThrow(/illisible/)
  })
})

describe('décision d’afficher une mise à jour', () => {
  const info = { version: '0.2.0', name: 'v0.2.0', url: RELEASES_PAGE, publishedAt: null }

  it('signale une version plus récente', () => {
    expect(evaluateUpdate('0.1.0', info, null, false)).toMatchObject({ status: 'available', current: '0.1.0', latest: '0.2.0' })
  })

  it('ne signale rien si l’application est à jour ou plus récente', () => {
    expect(evaluateUpdate('0.2.0', info, null, true).status).toBe('up-to-date')
    expect(evaluateUpdate('0.3.0', info, null, true).status).toBe('up-to-date')
  })

  it('une version ignorée n’est pas signalée au démarrage, mais l’est sur demande', () => {
    expect(evaluateUpdate('0.1.0', info, '0.2.0', false).status).toBe('skipped')
    expect(evaluateUpdate('0.1.0', info, '0.2.0', true).status).toBe('available')
    // Une version encore plus récente que celle ignorée est de nouveau annoncée.
    expect(evaluateUpdate('0.1.0', { ...info, version: '0.3.0' }, '0.2.0', false).status).toBe('available')
  })

  it('ne lève jamais d’exception : hors ligne, erreur serveur, aucune version', async () => {
    const offline = async () => {
      throw new TypeError('fetch failed')
    }
    expect(await checkForUpdates(offline, '0.1.0', null, true)).toMatchObject({ status: 'error', message: expect.stringMatching(/connexion/) })
    expect(await checkForUpdates(fakeFetch(500), '0.1.0', null, true)).toMatchObject({ status: 'error', message: expect.stringMatching(/500/) })
    expect(await checkForUpdates(fakeFetch(404), '0.1.0', null, true)).toEqual({ status: 'up-to-date', current: '0.1.0', latest: null })
    expect(await checkForUpdates(fakeFetch(200, release('v0.1.1')), '0.1.0', null, false)).toMatchObject({ status: 'available', latest: '0.1.1' })
  })
})

describe('préférences', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pixelatelier-settings-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('valeurs par défaut, enregistrement et relecture', async () => {
    const file = path.join(dir, 'settings.json')
    expect(await new SettingsStore(file).get()).toEqual(DEFAULT_SETTINGS)
    await new SettingsStore(file).update({ skippedVersion: '0.2.0', checkUpdatesOnStartup: false })
    expect(await new SettingsStore(file).get()).toEqual({ skippedVersion: '0.2.0', checkUpdatesOnStartup: false })
  })

  it('un fichier illisible ou incohérent donne les valeurs par défaut', async () => {
    const file = path.join(dir, 'corrompu.json')
    writeFileSync(file, '{ pas du json')
    expect(await new SettingsStore(file).get()).toEqual(DEFAULT_SETTINGS)
    writeFileSync(file, JSON.stringify({ checkUpdatesOnStartup: 'oui', skippedVersion: 42 }))
    expect(await new SettingsStore(file).get()).toEqual(DEFAULT_SETTINGS)
  })
})
