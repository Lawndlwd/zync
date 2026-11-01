import { useState } from 'react'

import { TextInput } from '../components/TextInput'

/**
 * A number box that keeps what is typed ("82." on the way to "82.5") and commits on blur or Enter.
 * A new `value` from outside replaces the text.
 */
export function AmountInput({
  value,
  onCommit,
  label,
  placeholder,
  className,
}: {
  value: string
  onCommit: (text: string) => void
  label: string
  placeholder?: string
  className?: string
}) {
  const [text, setText] = useState(value)
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setText(value)
  }
  return (
    <TextInput
      compact
      inputMode="decimal"
      className={className}
      value={text}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== value) onCommit(text)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}
