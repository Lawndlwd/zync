import { forwardRef, type InputHTMLAttributes } from 'react'

/** Borderless heading-sized input (card and page titles). */
export const TitleInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TitleInput(
  { className = '', ...rest },
  ref,
) {
  return <input ref={ref} className={`title-in h2 ${className}`} {...rest} />
})
