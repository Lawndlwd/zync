import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'

// zync buttons. Every clickable control in the app goes through these — never a bare <button>.

type Variant = 'primary' | 'soft' | 'ghost' | 'danger' | 'destroy'
type Size = 'sm' | 'md' | 'lg'

const cls = (variant: Variant, size: Size, extra = '') =>
  `btn btn-${variant}${size === 'md' ? '' : ` btn-${size}`}${extra ? ` ${extra}` : ''}`

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  busy?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', busy, className = '', type = 'button', disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cls(variant, size, `${className}${busy ? ' is-busy' : ''}`)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {children}
    </button>
  )
})

export function ButtonLink({
  variant = 'ghost',
  size = 'md',
  className = '',
  ...rest
}: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={cls(variant, size, className)} {...rest} />
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  small?: boolean
  children: ReactNode
}

/** Square icon button; `label` is required so every icon has an accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, small, className = '', type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`ibtn${small ? ' ibtn-s' : ''} ${className}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  )
})

/** Bracketed mono text action, e.g. [View ↗]. */
export const TextButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function TextButton(
  { className = '', type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={`link ${className}`} {...rest} />
})
