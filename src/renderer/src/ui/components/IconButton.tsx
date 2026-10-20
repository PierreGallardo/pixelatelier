import type { ReactNode } from 'react'

interface IconButtonProps {
  /** Texte de l'infobulle (et nom accessible). */
  title: string
  onClick(): void
  children: ReactNode
  active?: boolean
  disabled?: boolean
  className?: string
}

/** Bouton icône avec infobulle ; ne prend pas le focus au clic de souris. */
export function IconButton({ title, onClick, children, active, disabled, className }: IconButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`icon-btn${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
