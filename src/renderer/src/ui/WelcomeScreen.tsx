import { FilePlus, FolderOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, isDesktop } from '../platform/api'
import { formatKeys } from './commands'
import { SIZE_PRESETS } from './dialogs/NewDocumentDialog'
import { useApp } from './useEditor'

function fileName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

/** Écran d'accueil : créer un document, ouvrir un fichier, fichiers récents. */
export function WelcomeScreen(): React.JSX.Element {
  const { actions, openDialog, commands } = useApp()
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    api
      .listRecent()
      .then((list) => alive && setRecent(list))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="welcome">
      <div className="welcome__card">
        <div className="welcome__brand">
          <span className="brand-mark brand-mark--large" />
          <div>
            <h1>Pixelatelier</h1>
            <p className="muted">Pixel art et animation image par image</p>
          </div>
        </div>

        <div className="welcome__actions">
          <button type="button" className="btn btn--primary btn--large" onClick={() => openDialog('new')}>
            <FilePlus size={18} /> Nouvelle image… <kbd>{formatKeys(commands['file.new'].keys?.[0])}</kbd>
          </button>
          <button type="button" className="btn btn--large" onClick={() => void actions.open()}>
            <FolderOpen size={18} /> Ouvrir… <kbd>{formatKeys(commands['file.open'].keys?.[0])}</kbd>
          </button>
        </div>

        <div className="welcome__section">
          <h2>Démarrage rapide</h2>
          <div className="welcome__presets">
            {SIZE_PRESETS.slice(0, 6).map((p) => (
              <button
                key={p.label}
                type="button"
                className="preset"
                onClick={() => actions.createDocument({ width: p.w, height: p.h, background: 'transparent' })}
                title={`Créer une image transparente de ${p.w} × ${p.h} pixels`}
              >
                <span className="preset__box checker" style={{ aspectRatio: `${p.w} / ${p.h}` }} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {isDesktop && (
          <div className="welcome__section">
            <h2>Fichiers récents</h2>
            {recent.length === 0 ? (
              <p className="muted small">Aucun projet récent. Les projets enregistrés ou ouverts apparaîtront ici.</p>
            ) : (
              <ul className="recent">
                {recent.map((p) => (
                  <li key={p}>
                    <button type="button" className="recent__item" title={p} onClick={() => void actions.openRecent(p)}>
                      <strong>{fileName(p)}</strong>
                      <span className="muted small">{p}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <p className="muted small welcome__hint">
          Formats : projets .pixatelier ; import d’images PNG, GIF (première image), JPEG, WebP et BMP.
        </p>
      </div>
    </div>
  )
}
