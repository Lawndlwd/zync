import {
  type CSSProperties,
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useLayoutEffect,
  useRef,
} from 'react'

// Text entry in the zync style: dashed field, solid accent ring on focus, brick on error.

export function Field({
  label,
  help,
  error,
  className = '',
  style,
  children,
}: {
  label?: ReactNode
  help?: ReactNode
  error?: ReactNode
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <label className={`field ${className}`} style={style}>
      {label && <span className="flabel">{label}</span>}
      {children}
      {error ? <span className="help err">{error}</span> : help ? <span className="help">{help}</span> : null}
    </label>
  )
}

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  mono?: boolean
  invalid?: boolean
  /** Compact 32px height used inside panels and property lists. */
  compact?: boolean
  icon?: ReactNode
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { mono, invalid, compact, icon, className = '', style, ...rest },
  ref,
) {
  const c = `input${mono ? ' monoin' : ''}${invalid ? ' err' : ''}${compact ? ' compact' : ''} ${className}`
  if (icon)
    return (
      <span className={`${c} has-icon`} style={style}>
        {icon}
        <input ref={ref} className="bare" aria-invalid={invalid || undefined} {...rest} />
      </span>
    )
  return <input ref={ref} className={c} style={style} aria-invalid={invalid || undefined} {...rest} />
})

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  mono?: boolean
  invalid?: boolean
  /** Grow with the content up to this many px. */
  autoGrow?: number
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { mono, invalid, autoGrow, className = '', onInput, ...rest },
  outer,
) {
  const inner = useRef<HTMLTextAreaElement | null>(null)
  const grow = () => {
    const el = inner.current
    if (!el || !autoGrow) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + 2, autoGrow)}px`
  }
  useLayoutEffect(grow)
  return (
    <textarea
      ref={(el) => {
        inner.current = el
        if (typeof outer === 'function') outer(el)
        else if (outer) outer.current = el
      }}
      className={`input textarea${mono ? ' monoin' : ''}${invalid ? ' err' : ''} ${className}`}
      aria-invalid={invalid || undefined}
      onInput={(e) => {
        grow()
        onInput?.(e)
      }}
      {...rest}
    />
  )
})

/** Borderless heading-sized input (card and page titles). */
export const TitleInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TitleInput(
  { className = '', ...rest },
  ref,
) {
  return <input ref={ref} className={`title-in h2 ${className}`} {...rest} />
})
