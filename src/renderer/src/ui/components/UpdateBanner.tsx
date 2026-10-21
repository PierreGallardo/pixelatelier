import { Download, X } from 'lucide-react'
import { formatReleaseDate, updates, useUpdates } from '../updateStore'
import { useApp } from '../useEditor'

/** Bandeau affiché sous la barre de menus quand une nouvelle version est publiée. */
export function UpdateBanner(): React.JSX.Element | null {
  const { available, mode, phase } = useUpdates()
  const { editor, actions } = useApp()
  if (!available) return null
  const notify = editor.notify.bind(editor)
  const date = formatReleaseDate(available.publishedAt)
  const close = (
    <button type="button" className="icon-btn" title="Masquer" aria-label="Masquer" onClick={() => updates.dismiss()}>
      <X size={16} />
    </button>
  )

  if (phase.step === 'downloading') {
    return (
      <div className="update-banner" role="status">
        <Download size={16} className="update-banner__icon" />
        <span className="update-banner__text">Téléchargement de Pixelatelier {available.latest}…</span>
        <span className="update-banner__progress" aria-label={`${phase.percent} %`}>
          <span style={{ width: `${phase.percent}%` }} />
        </span>
        <span className="update-banner__percent">{phase.percent} %</span>
      </div>
    )
  }

  if (phase.step === 'ready') {
    return (
      <div className="update-banner" role="status">
        <Download size={16} className="update-banner__icon" />
        <span className="update-banner__text">
          <strong>Pixelatelier {phase.version}</strong> est prête. Le logiciel va redémarrer pour l’installer.
        </span>
        <button
          type="button"
          className="btn btn--primary btn--small"
          onClick={() => void updates.install(() => actions.ensureCanDiscard(), notify)}
        >
          Redémarrer et installer
        </button>
        <button type="button" className="btn btn--small" title="La mise à jour sera installée à la fermeture du logiciel" onClick={() => updates.dismiss()}>
          À la fermeture
        </button>
      </div>
    )
  }

  if (phase.step === 'opened') {
    return (
      <div className="update-banner" role="status">
        <Download size={16} className="update-banner__icon" />
        <span className="update-banner__text">
          L’installateur de <strong>Pixelatelier {available.latest}</strong> est ouvert : glissez Pixelatelier dans le dossier Applications (remplacer
          l’ancienne version), puis relancez le logiciel.
        </span>
        {close}
      </div>
    )
  }

  if (phase.step === 'error') {
    return (
      <div className="update-banner update-banner--error" role="alert">
        <Download size={16} className="update-banner__icon" />
        <span className="update-banner__text">Mise à jour impossible : {phase.message}</span>
        <button type="button" className="btn btn--primary btn--small" onClick={() => void updates.update(notify)}>
          Réessayer
        </button>
        <button type="button" className="btn btn--small" onClick={() => void updates.download(notify)}>
          Page de téléchargement
        </button>
        {close}
      </div>
    )
  }

  return (
    <div className="update-banner" role="status">
      <Download size={16} className="update-banner__icon" />
      <span className="update-banner__text">
        <strong>Pixelatelier {available.latest}</strong> est disponible{date ? ` (publiée le ${date})` : ''}. Vous utilisez la version{' '}
        {available.current}.
      </span>
      <button type="button" className="btn btn--primary btn--small" onClick={() => void updates.update(notify)}>
        {mode === 'page' ? 'Télécharger' : 'Mettre à jour'}
      </button>
      <button type="button" className="btn btn--small" onClick={() => void updates.skip(notify)} title="Ne plus signaler cette version au démarrage">
        Ignorer cette version
      </button>
      <button type="button" className="icon-btn" title="Plus tard (rappel au prochain démarrage)" aria-label="Plus tard" onClick={() => updates.dismiss()}>
        <X size={16} />
      </button>
    </div>
  )
}
