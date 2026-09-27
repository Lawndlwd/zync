import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

export type TextInputProps = {
  mono?: boolean
  invalid?: boolean
  /** Compact 32px height used inside panels and property lists. */
  compact?: boolean
  icon?: ReactNode
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>

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
