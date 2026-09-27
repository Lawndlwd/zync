import { type ButtonHTMLAttributes, forwardRef } from 'react'

/** Bracketed mono text action, e.g. [View ↗]. */
export const TextButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function TextButton(
  { className = '', type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={`link ${className}`} {...rest} />
})
