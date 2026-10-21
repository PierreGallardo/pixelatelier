import { formatKeys, runCommand, type CommandId } from '../commands'
import { useUpdates } from '../updateStore'
import { useApp } from '../useEditor'
import { Modal } from './Modal'

const GROUPS: { title: string; ids: CommandId[] }[] = [
  { title: 'Fichier', ids: ['file.new', 'file.open', 'file.save', 'file.saveAs', 'file.exportPng', 'file.exportGif', 'file.exportSheet', 'file.close'] },
  {
    title: 'Édition et sélection',
    ids: [
      'edit.undo',
      'edit.redo',
      'edit.cut',
      'edit.copy',
      'edit.copyMerged',
      'edit.paste',
      'edit.delete',
      'edit.selectAll',
      'edit.deselect',
      'edit.invertSelection',
      'edit.swapColors'
    ]
  },
  {
    title: 'Outils',
    ids: [
      'tool.select',
      'tool.wand',
      'tool.pencil',
      'tool.eraser',
      'tool.picker',
      'tool.fill',
      'tool.line',
      'tool.rect',
      'tool.rectFilled',
      'tool.ellipse',
      'tool.ellipseFilled',
      'tool.pixelPerfect',
      'tool.brushSmaller',
      'tool.brushBigger'
    ]
  },
  { title: 'Vue et image', ids: ['view.zoomIn', 'view.zoomOut', 'view.fit', 'view.actualSize', 'view.grid', 'view.symmetryX', 'view.symmetryY', 'image.flipH', 'image.flipV', 'image.canvasSize', 'image.scale'] },
  { title: 'Calques', ids: ['layer.new', 'layer.duplicate', 'layer.delete', 'layer.up', 'layer.down', 'layer.mergeDown', 'layer.toggleVisible', 'layer.selectAbove', 'layer.selectBelow'] },
  {
    title: 'Animation',
    ids: [
      'anim.play',
      'anim.newFrame',
      'anim.duplicateFrame',
      'anim.deleteFrame',
      'anim.prevFrame',
      'anim.nextFrame',
      'anim.firstFrame',
      'anim.lastFrame',
      'anim.moveFrameLeft',
      'anim.moveFrameRight',
      'anim.onion'
    ]
  }
]

const MOUSE: [string, string][] = [
  ['Clic gauche / droit', 'Dessiner avec la couleur principale / secondaire'],
  ['Alt + clic', 'Pipette temporaire'],
  ['Maj + clic (crayon)', 'Ligne depuis le dernier point'],
  ['Maj pendant une forme', 'Carré, cercle ou angle de 45°'],
  ['Molette', 'Zoom centré sur le pointeur'],
  ['Maj + molette', 'Défilement horizontal'],
  ['Espace + glisser, clic molette', 'Déplacer la vue'],
  ['Échap', 'Annuler la forme ou le collage, sinon désélectionner'],
  ['Entrée (collage en cours)', 'Valider le collage'],
  ['Flèches (collage en cours)', 'Déplacer d’un pixel (Maj : 10 px)'],
  ['Maj / Alt + sélection', 'Ajouter / retirer de la sélection'],
  ['Glisser dans la sélection', 'Déplacer son contenu']
]

export function ShortcutsDialog({ onClose }: { onClose(): void }): React.JSX.Element {
  const { commands } = useApp()
  return (
    <Modal title="Raccourcis clavier" onClose={onClose} width={760}>
      <div className="shortcuts">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3>{g.title}</h3>
            <dl>
              {g.ids.map((id) => {
                const keys = commands[id].keys ?? []
                if (keys.length === 0) return null
                return (
                  <div key={id} className="shortcuts__row">
                    <dt>{commands[id].label.replace(/…$/, '')}</dt>
                    <dd>
                      {keys.slice(0, 2).map((k) => (
                        <kbd key={k}>{formatKeys(k)}</kbd>
                      ))}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </section>
        ))}
        <section>
          <h3>Souris et modificateurs</h3>
          <dl>
            {MOUSE.map(([k, v]) => (
              <div key={k} className="shortcuts__row">
                <dt>{v}</dt>
                <dd>
                  <kbd>{k}</kbd>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </Modal>
  )
}

export function AboutDialog({ onClose }: { onClose(): void }): React.JSX.Element {
  const { commands } = useApp()
  const { checking, available } = useUpdates()
  return (
    <Modal title="À propos" onClose={onClose} width={420}>
      <div className="about">
        <div className="about__brand">
          <span className="brand-mark brand-mark--large" />
          <div>
            <strong>Pixelatelier</strong>
            <div className="muted">Version {__APP_VERSION__}</div>
          </div>
        </div>
        <p>Éditeur de pixel art et d’animation image par image. Il fonctionne hors ligne ; seule la recherche de mises à jour consulte GitHub.</p>
        <p className="about__update">
          {available ? (
            <span>La version {available.latest} est disponible (bandeau en haut de la fenêtre).</span>
          ) : (
            <button type="button" className="btn btn--small" disabled={checking} onClick={() => runCommand(commands['help.checkUpdates'])}>
              {checking ? 'Recherche en cours…' : 'Rechercher des mises à jour'}
            </button>
          )}
        </p>
        <p className="muted small">
          Electron, React, TypeScript et Canvas 2D. Encodeurs PNG et GIF, format de projet .pixatelier et algorithmes de tracé écrits pour ce projet.
          Icônes : Lucide (licence ISC).
        </p>
      </div>
    </Modal>
  )
}
