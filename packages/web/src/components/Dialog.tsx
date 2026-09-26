import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconCheck, IconCross } from '../icons'
import { Button, IconButton } from './Button'
import { Field, TextInput } from './Field'

// Confirm dialog + toasts, replacing window.confirm/alert. One provider at the app root.

interface ConfirmOptions {
  title: string
  body?: ReactNode
  confirmLabel?: string
  destructive?: boolean
  /** Ask the user to type this exact text before confirming (big destructive actions). */
  typeToConfirm?: string
}

interface Toast {
  id: number
  text: ReactNode
  tone: 'ok' | 'bad' | 'quiet'
}

interface Ctx {
  confirm: (o: ConfirmOptions) => Promise<boolean>
  toast: (text: ReactNode, tone?: Toast['tone']) => void
}

const DialogContext = createContext<Ctx | null>(null)

export function useConfirm() {
  const c = useContext(DialogContext)
  if (!c) throw new Error('useConfirm outside DialogProvider')
  return c.confirm
}

export function useToast() {
  const c = useContext(DialogContext)
  if (!c) throw new Error('useToast outside DialogProvider')
  return c.toast
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setReq({ ...o, resolve })), [])
  const toast = useCallback((text: ReactNode, tone: Toast['tone'] = 'ok') => {
    const id = ++seq.current
    setToasts((t) => [...t, { id, text, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  return (
    <DialogContext.Provider value={{ confirm, toast }}>
      {children}
      {req && (
        <ConfirmDialog
          {...req}
          onClose={(v) => {
            req.resolve(v)
            setReq(null)
          }}
        />
      )}
      {toasts.length > 0 &&
        createPortal(
          <div className="toasts" role="status" aria-live="polite">
            {toasts.map((t) => (
              <div key={t.id} className={`toast${t.tone === 'ok' ? '' : ` ${t.tone}`}`}>
                {t.tone === 'bad' ? <IconCross size={14} sw={2} /> : <IconCheck size={14} sw={2} />}
                <span className="toast-text">{t.text}</span>
                <IconButton
                  small
                  label="Dismiss"
                  style={{ color: 'inherit' }}
                  onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
                >
                  <IconCross size={12} sw={1.6} />
                </IconButton>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </DialogContext.Provider>
  )
}

function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Confirm',
  destructive,
  typeToConfirm,
  onClose,
}: ConfirmOptions & { onClose: (v: boolean) => void }) {
  const [typed, setTyped] = useState('')
  const ok = !typeToConfirm || typed.trim() === typeToConfirm
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!typeToConfirm) confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, typeToConfirm])

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
          <Button ref={confirmRef} type="submit" variant={destructive ? 'destroy' : 'primary'} disabled={!ok}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
