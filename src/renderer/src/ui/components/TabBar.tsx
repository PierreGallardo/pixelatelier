import { Plus, X } from 'lucide-react'
import { formatKeys } from '../commands'
import { useApp, useEditor } from '../useEditor'

/** Onglets des documents ouverts, au-dessus de la zone de travail. */
export function TabBar(): React.JSX.Element {
  const editor = useEditor()
  const { actions, commands, openDialog } = useApp()
  const tabs = editor.tabList
  const next = commands['file.nextTab'].keys?.[0]

  return (
    <div className="tabbar" role="tablist" aria-label="Documents ouverts">
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tab"
          aria-selected={tab.active}
          className={`tabbar__tab${tab.active ? ' is-active' : ''}`}
          title={`${tab.path ?? `${tab.name} (jamais enregistré)`}${next ? `\nDocument suivant : ${formatKeys(next)}` : ''}`}
          onMouseDown={(e) => {
            // Clic molette : fermer l'onglet, comme dans un navigateur.
            if (e.button === 1) {
              e.preventDefault()
              void actions.closeTab(index)
            }
          }}
          onClick={() => editor.switchTab(index)}
        >
          <span className="tabbar__name">{tab.name}</span>
          {tab.dirty && (
            <span className="tabbar__dirty" title="Modifications non enregistrées" aria-label="modifié">
              •
            </span>
          )}
          <button
            type="button"
            className="tabbar__close"
            title={`Fermer « ${tab.name} »`}
            aria-label={`Fermer « ${tab.name} »`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation()
              void actions.closeTab(index)
            }}
          >
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="tabbar__new"
        title={`Nouvelle image (${formatKeys(commands['file.new'].keys?.[0])})`}
        aria-label="Nouvelle image"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => openDialog('new')}
      >
        <Plus size={15} />
      </button>
    </div>
  )
}
