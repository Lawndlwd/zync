import { type ButtonHTMLAttributes, forwardRef } from 'react'

import { buttonClass, type Size, type Variant } from '../helpers/buttons'

// zync buttons. Every clickable control in the app goes through these — never a bare <button>.

export type ButtonProps = {
  variant?: Variant
  size?: Size
  busy?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', busy, className = '', type = 'button', disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, `${className}${busy ? ' is-busy' : ''}`)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {children}
    </button>
  )
})
