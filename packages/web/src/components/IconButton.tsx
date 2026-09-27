import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react'

export type IconButtonProps = {
  label: string
  small?: boolean
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

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
