import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { IconCheck, IconCross } from '../icons'
import { ConfirmDialog } from './ConfirmDialog'
import { IconButton } from './IconButton'

// Confirm dialog + toasts, replacing window.confirm/alert. One provider at the app root.

export type ConfirmOptions = {
  title: string
  body?: ReactNode
  confirmLabel?: string
  destructive?: boolean
  /** Ask the user to type this exact text before confirming (big destructive actions). */
  typeToConfirm?: string
}

type Toast = {
  id: number
  text: ReactNode
  tone: 'ok' | 'bad' | 'quiet'
}

type Ctx = {
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

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setReq({ ...o, resolve })
      }),
    [],
  )
  const toast = useCallback((text: ReactNode, tone: Toast['tone'] = 'ok') => {
    const id = ++seq.current
    setToasts((t) => [...t, { id, text, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  const ctx = useMemo(() => ({ confirm, toast }), [confirm, toast])

  return (
    <DialogContext.Provider value={ctx}>
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
