import { useSyncExternalStore } from 'react'
import type { UpdateCheckResult } from '../../../shared/api'
import { api, errorMessage } from '../platform/api'
import type { NoticeKind } from '../editor/Editor'

export type AvailableUpdate = Extract<UpdateCheckResult, { status: 'available' }>

export interface UpdateState {
  /** Nouvelle version à annoncer (bandeau), ou `null`. */
  available: AvailableUpdate | null
  /** Recherche automatique au démarrage. */
  autoCheck: boolean
  checking: boolean
}

type Notify = (text: string, kind?: NoticeKind) => void

/** Délai avant la recherche automatique, pour ne pas ralentir le démarrage. */
const STARTUP_DELAY_MS = 3000

/**
 * État des mises à jour, partagé par le bandeau, le menu Aide et la fenêtre « À propos ».
 * La requête réseau elle-même est faite par le processus principal.
 */
class UpdateStore {
  private state: UpdateState = { available: null, autoCheck: false, checking: false }
  private listeners = new Set<() => void>()
  private started = false

  get snapshot(): UpdateState {
    return this.state
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private set(patch: Partial<UpdateState>): void {
    this.state = { ...this.state, ...patch }
    for (const fn of [...this.listeners]) fn()
  }

  /** Lit les préférences et lance la recherche automatique (une seule fois par session). */
  async start(notify: Notify): Promise<void> {
    if (this.started) return
    this.started = true
    try {
      const prefs = await api.getUpdatePreferences()
      this.set({ autoCheck: prefs.autoCheck })
      if (prefs.autoCheck) setTimeout(() => void this.check(false, notify), STARTUP_DELAY_MS)
    } catch {
      // Préférences indisponibles : pas de recherche automatique.
    }
  }

  /** Recherche une nouvelle version ; `manual` affiche aussi les résultats « à jour » et les erreurs. */
  async check(manual: boolean, notify: Notify): Promise<void> {
    if (this.state.checking) return
    this.set({ checking: true })
    let result: UpdateCheckResult
    try {
      result = await api.checkForUpdates(manual)
    } catch (err) {
      result = { status: 'error', current: __APP_VERSION__, message: errorMessage(err) }
    }
    this.set({ checking: false })
    switch (result.status) {
      case 'available':
        this.set({ available: result })
        break
      case 'up-to-date':
        if (manual) notify(`Pixelatelier est à jour (version ${result.current}).`)
        break
      case 'error':
        if (manual) notify(`Recherche de mise à jour impossible : ${result.message}`, 'error')
        break
      case 'unsupported':
        if (manual) notify('La recherche de mises à jour n’est disponible que dans l’application de bureau.')
        break
      case 'skipped':
        break
    }
  }

  /** « Plus tard » : masque le bandeau jusqu'au prochain démarrage. */
  dismiss(): void {
    this.set({ available: null })
  }

  /** « Ignorer cette version » : ne plus l'annoncer au démarrage. */
  async skip(notify: Notify): Promise<void> {
    const update = this.state.available
    if (!update) return
    this.set({ available: null })
    try {
      await api.skipUpdate(update.latest)
      notify(`La version ${update.latest} ne sera plus signalée. Aide > Rechercher des mises à jour permet de la retrouver.`)
    } catch (err) {
      notify(errorMessage(err), 'error')
    }
  }

  async download(notify: Notify): Promise<void> {
    const update = this.state.available
    if (!update) return
    try {
      await api.openReleasePage(update.url)
    } catch (err) {
      notify(errorMessage(err), 'error')
    }
  }

  async setAutoCheck(enabled: boolean, notify: Notify): Promise<void> {
    try {
      await api.setAutoUpdateCheck(enabled)
      this.set({ autoCheck: enabled })
    } catch (err) {
      notify(errorMessage(err), 'error')
    }
  }
}

export const updates = new UpdateStore()

export function useUpdates(): UpdateState {
  return useSyncExternalStore(updates.subscribe, () => updates.snapshot)
}

/** Date de publication lisible (« 20 octobre 2026 »), ou chaîne vide. */
export function formatReleaseDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
