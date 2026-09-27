import { useState } from 'react'
import { createPortal } from 'react-dom'

import { useEventListener } from '../hooks/useEventListener'
import { IconCross } from '../icons'
import { Button } from './Button'
import type { ConfirmOptions } from './Dialog'
import { Field } from './Field'
import { IconButton } from './IconButton'
import { TextInput } from './TextInput'

export function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Confirm',
  destructive,
  typeToConfirm,
  onClose,
}: ConfirmOptions & { onClose: (v: boolean) => void }) {
  const [typed, setTyped] = useState('')
  const ok = !typeToConfirm || typed.trim() === typeToConfirm
  // Capture phase: Esc closes the dialog before anything underneath (a panel) sees it.
  useEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose(false)
      }
    },
    { capture: true },
  )

  return createPortal(
    <div className="dialog-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}>
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dlg-t"
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          if (ok) onClose(true)
        }}
      >
        <div className="row between">
          <span id="dlg-t" className="mono">
            {title}
          </span>
          <IconButton small label="Close" onClick={() => onClose(false)}>
            <IconCross size={13} sw={1.6} />
          </IconButton>
        </div>
        {body && (
          <div className="small" style={{ margin: 0 }}>
            {body}
          </div>
        )}
        {typeToConfirm && (
          <Field label={`Type “${typeToConfirm}” to confirm`}>
            <TextInput autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
        )}
        <div className="row g8" style={{ justifyContent: 'flex-end' }}>
          <Button onClick={() => onClose(false)}>Cancel</Button>
          <Button autoFocus={!typeToConfirm} type="submit" variant={destructive ? 'destroy' : 'primary'} disabled={!ok}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
