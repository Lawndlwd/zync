import { TextButton } from '../components/TextButton'
import { ago } from '../helpers/dates'
import type { Passkey } from '../types/auth'

export function PasskeyRow({ passkey, onRemove }: { passkey: Passkey; onRemove: () => void }) {
  return (
    <div className="lr">
      <span className="grow trunc">{passkey.name}</span>
      <span className="mono-s muted">
        added {ago(new Date(passkey.createdAt))} ·{' '}
        {passkey.lastUsedAt ? `used ${ago(new Date(passkey.lastUsedAt))}` : 'never used'}
      </span>
      <TextButton className="danger-t" onClick={onRemove}>
        [Remove]
      </TextButton>
    </div>
  )
}
