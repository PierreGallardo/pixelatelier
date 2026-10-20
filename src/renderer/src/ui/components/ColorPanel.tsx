import { ArrowLeftRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { hsvToRgb, parseHex, rgbToHsv, toCss, toHex, type HSV, type RGBA } from '../../model/color'
import { formatKeys } from '../commands'
import { useApp, useEditor } from '../useEditor'
import { IconButton } from './IconButton'

type Target = 'primary' | 'secondary'

/** Glissement continu sur un élément : appelle `onValue(x, y)` normalisés dans [0, 1]. */
function useDrag2D(onValue: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useRef(onValue)
  cb.current = onValue
  const handlers = {
    onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
      const el = ref.current
      if (!el || e.button !== 0) return
      el.setPointerCapture(e.pointerId)
      const update = (ev: { clientX: number; clientY: number }): void => {
        const r = el.getBoundingClientRect()
        const x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width))
        const y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))
        cb.current(x, y)
      }
      update(e)
      const move = (ev: PointerEvent): void => update(ev)
      const up = (): void => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerup', up)
        el.removeEventListener('pointercancel', up)
      }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', up)
      el.addEventListener('pointercancel', up)
    }
  }
  return { ref, ...handlers }
}

interface PickerProps {
  color: RGBA
  onChange(c: RGBA): void
}

/** Sélecteur TSV (teinte, saturation, valeur) avec canal alpha et saisie hexadécimale. */
function ColorPicker({ color, onChange }: PickerProps): React.JSX.Element {
  // La teinte est conservée localement : elle est indéfinie pour les gris.
  const [hsv, setHsv] = useState<HSV>(() => rgbToHsv(color.r, color.g, color.b))
  const lastEmitted = useRef<RGBA | null>(null)
  const [hexDraft, setHexDraft] = useState<string | null>(null)

  useEffect(() => {
    const le = lastEmitted.current
    if (le && le.r === color.r && le.g === color.g && le.b === color.b) return
    const next = rgbToHsv(color.r, color.g, color.b)
    setHsv((prev) => ({ h: next.s === 0 || next.v === 0 ? prev.h : next.h, s: next.v === 0 ? prev.s : next.s, v: next.v }))
  }, [color.r, color.g, color.b])

  const emit = (next: HSV, alpha = color.a): void => {
    setHsv(next)
    const rgb = hsvToRgb(next.h, next.s, next.v)
    const c = { ...rgb, a: alpha }
    lastEmitted.current = c
    onChange(c)
  }

  const sv = useDrag2D((x, y) => emit({ h: hsv.h, s: x, v: 1 - y }))
  const hue = useDrag2D((x) => emit({ ...hsv, h: Math.min(359.9, x * 360) }))
  const alpha = useDrag2D((x) => {
    lastEmitted.current = color
    onChange({ ...color, a: Math.round(x * 255) })
  })

  const pure = hsvToRgb(hsv.h, 1, 1)
  const opaque = toCss({ ...color, a: 255 })

  const commitHex = (): void => {
    if (hexDraft === null) return
    const parsed = parseHex(hexDraft)
    setHexDraft(null)
    if (parsed) onChange(parsed)
  }

  const setChannel = (key: keyof RGBA, value: string): void => {
    const n = Number(value)
    if (!Number.isFinite(n)) return
    onChange({ ...color, [key]: Math.min(255, Math.max(0, Math.round(n))) })
  }

  return (
    <div className="picker">
      <div
        className="picker__sv"
        ref={sv.ref}
        onPointerDown={sv.onPointerDown}
        style={{ backgroundColor: `rgb(${pure.r}, ${pure.g}, ${pure.b})` }}
        title="Saturation et luminosité"
      >
        <div className="picker__sv-white" />
        <div className="picker__sv-black" />
        <div className="picker__sv-handle" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
      </div>
      <div className="picker__bar picker__hue" ref={hue.ref} onPointerDown={hue.onPointerDown} title="Teinte">
        <div className="picker__bar-handle" style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </div>
      <div className="picker__bar picker__alpha checker" ref={alpha.ref} onPointerDown={alpha.onPointerDown} title="Opacité (alpha)">
        <div className="picker__alpha-fill" style={{ background: `linear-gradient(to right, transparent, ${opaque})` }} />
        <div className="picker__bar-handle" style={{ left: `${(color.a / 255) * 100}%` }} />
      </div>
      <div className="picker__fields">
        <label className="field field--hex" title="Couleur hexadécimale (#rrggbb ou #rrggbbaa)">
          <span>Hex</span>
          <input
            value={hexDraft ?? toHex(color)}
            spellCheck={false}
            onChange={(e) => setHexDraft(e.target.value)}
            onBlur={commitHex}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitHex()
              if (e.key === 'Escape') setHexDraft(null)
            }}
          />
        </label>
        {(['r', 'g', 'b', 'a'] as const).map((k) => (
          <label key={k} className="field field--channel" title={{ r: 'Rouge', g: 'Vert', b: 'Bleu', a: 'Alpha' }[k]}>
            <span>{k.toUpperCase()}</span>
            <input type="number" min={0} max={255} value={color[k]} onChange={(e) => setChannel(k, e.target.value)} />
          </label>
        ))}
      </div>
    </div>
  )
}

/** Couleurs principale/secondaire et sélecteur de couleur. */
export function ColorPanel(): React.JSX.Element {
  const editor = useEditor()
  const { commands } = useApp()
  const [target, setTarget] = useState<Target>('primary')
  const color = target === 'primary' ? editor.primary : editor.secondary

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>Couleurs</h2>
      </header>
      <div className="colors">
        <div className="colors__swatches">
          <button
            type="button"
            className={`swatch-big swatch-big--primary checker${target === 'primary' ? ' is-target' : ''}`}
            title="Couleur principale (clic gauche) — cliquer pour la modifier"
            onClick={() => setTarget('primary')}
          >
            <span style={{ background: toCss(editor.primary) }} />
          </button>
          <button
            type="button"
            className={`swatch-big swatch-big--secondary checker${target === 'secondary' ? ' is-target' : ''}`}
            title="Couleur secondaire (clic droit) — cliquer pour la modifier"
            onClick={() => setTarget('secondary')}
          >
            <span style={{ background: toCss(editor.secondary) }} />
          </button>
          <IconButton title={`Échanger les couleurs (${formatKeys(commands['edit.swapColors'].keys?.[0])})`} onClick={() => editor.swapColors()} className="colors__swap">
            <ArrowLeftRight size={14} />
          </IconButton>
        </div>
        <div className="colors__info">
          <div className="colors__label">{target === 'primary' ? 'Principale' : 'Secondaire'}</div>
          <div className="colors__hex">{toHex(color)}</div>
        </div>
      </div>
      <ColorPicker color={color} onChange={(c) => (target === 'primary' ? editor.setPrimary(c) : editor.setSecondary(c))} />
    </section>
  )
}
