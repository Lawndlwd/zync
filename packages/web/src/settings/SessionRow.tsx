import { TextButton } from '../components/TextButton'
import { deviceName } from '../helpers/auth'
import { ago } from '../helpers/dates'
import type { AuthSession } from '../types/auth'

export function SessionRow({ session, onRevoke }: { session: AuthSession; onRevoke: () => void }) {
  return (
    <div className="lr">
      <span className="grow trunc" title={session.userAgent}>
        {deviceName(session.userAgent)}
        {session.current && (
          <span className="tag" style={{ marginLeft: 8, height: 20 }}>
            this device
          </span>
        )}
      </span>
      <span className="mono-s muted">
        {session.ip} · active {ago(new Date(session.lastSeenAt))}
      </span>
      <TextButton className="danger-t" onClick={onRevoke}>
        [Sign out]
      </TextButton>
    </div>
  )
}
