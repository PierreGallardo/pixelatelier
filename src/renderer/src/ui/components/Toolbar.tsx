import { Circle, Eraser, PaintBucket, Pencil, Pipette, Slash, Square, SquareDashed, WandSparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ToolId } from '../../editor/Editor'
import { TOOLS } from '../../tools/tools'
import { formatKeys } from '../commands'
import { useApp, useEditor } from '../useEditor'
import { IconButton } from './IconButton'

const ICON_SIZE = 18

const ICONS: Record<ToolId, ReactNode> = {
  select: <SquareDashed size={ICON_SIZE} />,
  wand: <WandSparkles size={ICON_SIZE} />,
  pencil: <Pencil size={ICON_SIZE} />,
  eraser: <Eraser size={ICON_SIZE} />,
  picker: <Pipette size={ICON_SIZE} />,
  fill: <PaintBucket size={ICON_SIZE} />,
  line: <Slash size={ICON_SIZE} />,
  rect: <Square size={ICON_SIZE} />,
  rectFilled: <Square size={ICON_SIZE} fill="currentColor" />,
  ellipse: <Circle size={ICON_SIZE} />,
  ellipseFilled: <Circle size={ICON_SIZE} fill="currentColor" />
}

/** Premier outil de chaque groupe (séparateur au-dessus). */
const GROUP_STARTS = new Set<ToolId>(['pencil', 'line'])

export function toolIcon(id: ToolId): ReactNode {
  return ICONS[id]
}

/** Barre d'outils verticale (à gauche). */
export function Toolbar(): React.JSX.Element {
  const editor = useEditor()
  const { commands } = useApp()
  return (
    <nav className="toolbar" aria-label="Outils">
      {TOOLS.map((t, i) => {
        const keys = commands[`tool.${t.id}`].keys?.[0]
        return (
          <div key={t.id} className={i > 0 && GROUP_STARTS.has(t.id) ? 'toolbar__group-start' : undefined}>
            <IconButton
              title={`${t.label} (${formatKeys(keys)})\n${t.hint}`}
              active={editor.tool === t.id}
              onClick={() => editor.setTool(t.id)}
            >
              {ICONS[t.id]}
            </IconButton>
          </div>
        )
      })}
    </nav>
  )
}
