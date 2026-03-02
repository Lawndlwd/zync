import { useState } from 'react'
import { Shield, Check, AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface VaultStepProps {
  vaultStatus: 'available' | 'uninitialized'
}

export function VaultStep({ vaultStatus }: VaultStepProps) {
  const [secretKey, setSecretKey] = useState('')
  const [saved, setSaved] = useState(false)

  if (vaultStatus === 'available') {
    return (
      <div className="flex flex-col items-center text-center max-w-lg mx-auto">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20">
          <Check className="h-8 w-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Vault Ready</h2>
        <p className="text-zinc-400 mb-4">
          Your encrypted vault is already set up. API keys and secrets are stored securely.
        </p>
        <Badge variant="success">SECRET_KEY configured</Badge>
      </div>
    )
  }

  const handleGenerate = async () => {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
    setSecretKey(hex)
  }

  return (
    <div className="flex flex-col items-center max-w-lg mx-auto">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20">
        <Shield className="h-8 w-8 text-amber-400" />
      </div>

      <h2 className="text-2xl font-bold text-zinc-100 mb-2 text-center">Create Your Vault</h2>
      <p className="text-zinc-400 mb-6 text-center text-sm leading-relaxed">
        Zync uses an encrypted vault to store your API keys locally. You need to set a <code className="text-zinc-300 bg-white/[0.06] px-1.5 py-0.5 rounded text-xs">SECRET_KEY</code> environment variable before the server starts.
      </p>

      <div className="w-full space-y-4">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-3">
          <p className="text-xs font-medium text-zinc-300">1. Generate a key</p>
          <div className="flex gap-2">
            <Input
              value={secretKey}
              readOnly
              placeholder="Click generate..."
              className="font-mono text-xs"
            />
            <Button variant="outline" size="sm" onClick={handleGenerate}>
              Generate
            </Button>
          </div>

          {secretKey && (
            <>
              <p className="text-xs font-medium text-zinc-300 mt-4">2. Add to your environment</p>
              <div className="rounded-lg bg-black/40 border border-white/[0.06] p-3">
                <code className="text-xs text-emerald-400 break-all select-all">
                  SECRET_KEY={secretKey}
                </code>
              </div>
              <p className="text-[11px] text-zinc-500">
                Add this to your <code className="text-zinc-400">.env</code> file in the project root, then restart the server.
              </p>

              <Button
                variant="default"
                size="sm"
                className="w-full mt-2"
                onClick={() => {
                  navigator.clipboard.writeText(`SECRET_KEY=${secretKey}`)
                  setSaved(true)
                }}
              >
                {saved ? 'Copied!' : 'Copy to Clipboard'}
              </Button>
            </>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80">
            The vault is required to save your API keys securely. You can skip this for now, but you'll need to set it up before configuring integrations.
          </p>
        </div>
      </div>
    </div>
  )
}
