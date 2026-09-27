import { useState } from 'react'

import { Button } from './Button'
import { Toggle } from './Toggle'

/**
 * Recovery codes, shown once: copy or download them, confirm they're saved, continue. Each code
 * signs in one time when no passkey is at hand.
 */
export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const text = `zync recovery codes — each works once\n\n${codes.join('\n')}\n`
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'zync-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="col g16">
      <p className="small" style={{ margin: 0 }}>
        If you lose your passkeys, these codes are the only way back in. Each works once. Keep them somewhere safe and
        offline (a password manager, a printout) — they won’t be shown again.
      </p>
      <ol className="recovery-codes">
        {codes.map((c) => (
          <li key={c} className="mono">
            {c}
          </li>
        ))}
      </ol>
      <div className="row g8 wrap">
        <Button
          size="sm"
          onClick={() =>
            void navigator.clipboard.writeText(text).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button size="sm" onClick={download}>
          Download .txt
        </Button>
      </div>
      <div className="row between g12 wrap">
        <span className="row g8 small">
          <Toggle label="I saved my recovery codes" checked={saved} onChange={setSaved} />
          I saved them somewhere safe
        </span>
        <Button variant="primary" disabled={!saved} onClick={onDone}>
          Continue
        </Button>
      </div>
    </div>
  )
}
