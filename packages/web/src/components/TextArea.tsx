import { forwardRef, type TextareaHTMLAttributes, useLayoutEffect, useRef } from 'react'

export type TextAreaProps = {
  mono?: boolean
  invalid?: boolean
  /** Grow with the content up to this many px. */
  autoGrow?: number
} & TextareaHTMLAttributes<HTMLTextAreaElement>

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
