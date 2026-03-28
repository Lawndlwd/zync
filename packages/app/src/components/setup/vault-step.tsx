import { AlertTriangle, Check, Shield } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setVaultPin } from '@/services/secrets'

interface VaultStepProps {
  vaultStatus: 'available' | 'uninitialized'
  hasPin?: boolean
}

export function VaultStep({ vaultStatus, hasPin }: VaultStepProps) {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  if (vaultStatus === 'available' && hasPin) {
    return (
      <div className="flex flex-col items-center text-center max-w-lg mx-auto">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20">
          <Check className="h-8 w-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Vault Ready</h2>
        <p className="text-muted-foreground mb-4">Your encrypted vault is set up and secured with a PIN.</p>
        <Badge variant="success">PIN configured</Badge>
      </div>
    )
  }

  if (vaultStatus !== 'available') {
    return (
      <div className="flex flex-col items-center text-center max-w-lg mx-auto">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Vault Not Available</h2>
        <p className="text-muted-foreground mb-4">
          The server needs a <code className="text-foreground bg-accent px-1.5 py-0.5 rounded text-xs">SECRET_KEY</code>{' '}
          environment variable. It should auto-generate on first start — try restarting the server.
        </p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex flex-col items-center text-center max-w-lg mx-auto">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20">
          <Check className="h-8 w-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">PIN Set</h2>
        <p className="text-muted-foreground mb-4">
          Use your 6-digit PIN to reveal secrets in the Vault. You can change it anytime from the Vault page.
        </p>
        <Badge variant="success">PIN configured</Badge>
      </div>
    )
  }

  const handleSave = async () => {
    if (pin.length !== 6) {
      toast.error('PIN must be 6 digits')
      return
    }
    if (pin !== confirmPin) {
      toast.error('PINs do not match')
      return
    }
    setSaving(true)
    try {
      await setVaultPin(pin)
      toast.success('Vault PIN set')
      setDone(true)
    } catch (err: any) {
      toast.error(err.message || 'Failed to set PIN')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-center max-w-lg mx-auto">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20">
        <Shield className="h-8 w-8 text-amber-400" />
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2 text-center">Secure Your Vault</h2>
      <p className="text-muted-foreground mb-6 text-center text-sm leading-relaxed">
        Set a 6-digit PIN to reveal your stored secrets. Your API keys are encrypted automatically — the PIN is just for
        viewing them.
      </p>

      <div className="w-full space-y-4">
        <div className="rounded-xl bg-card border border-border p-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Choose a 6-digit PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                if (/^\d{0,6}$/.test(e.target.value)) setPin(e.target.value)
              }}
              placeholder="••••••"
              className="text-center tracking-[0.5em] text-lg font-mono h-12"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Confirm PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => {
                if (/^\d{0,6}$/.test(e.target.value)) setConfirmPin(e.target.value)
              }}
              placeholder="••••••"
              className="text-center tracking-[0.5em] text-lg font-mono h-12"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pin.length === 6 && confirmPin.length === 6) handleSave()
              }}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleSave}
            disabled={saving || pin.length !== 6 || confirmPin.length !== 6}
          >
            {saving ? 'Setting PIN...' : 'Set PIN'}
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80">
            Remember this PIN — you'll need it to view your stored API keys and tokens.
          </p>
        </div>
      </div>
    </div>
  )
}
