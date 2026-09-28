import { IconCheck } from '../icons'

/** A tick box (`.checkbox`), like the - [ ] boxes of a markdown checklist. */
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`checkbox${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      {checked && <IconCheck size={11} sw={2.2} />}
    </button>
  )
}
