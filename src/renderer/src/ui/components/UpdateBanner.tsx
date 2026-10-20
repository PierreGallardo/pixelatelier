import { Download, X } from 'lucide-react'
import { formatReleaseDate, updates, useUpdates } from '../updateStore'
import { useApp } from '../useEditor'

/** Bandeau affiché sous la barre de menus quand une nouvelle version est publiée. */
export function UpdateBanner(): React.JSX.Element | null {
  const { available } = useUpdates()
  const { editor } = useApp()
  if (!available) return null
  const notify = editor.notify.bind(editor)
  const date = formatReleaseDate(available.publishedAt)
  return (
    <div className="update-banner" role="status">
      <Download size={16} className="update-banner__icon" />
      <span className="update-banner__text">
        <strong>Pixelatelier {available.latest}</strong> est disponible{date ? ` (publiée le ${date})` : ''}. Vous utilisez la version{' '}
        {available.current}.
      </span>
      <button type="button" className="btn btn--primary btn--small" onClick={() => void updates.download(notify)}>
        Télécharger
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
