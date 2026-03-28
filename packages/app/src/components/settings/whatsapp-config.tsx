import { useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  useChannelConfig,
  useConnectChannel,
  useDisconnectChannel,
  useSaveChannelConfig,
  useWhatsAppQR,
} from '@/hooks/useBot'

export function WhatsAppConfig({
  connected: connectedProp,
  connectionState,
}: {
  connected: boolean
  connectionState: string
}) {
  const queryClient = useQueryClient()
  const { data: cfg } = useChannelConfig()
  const saveConfig = useSaveChannelConfig()
  const connect = useConnectChannel()
  const disconnect = useDisconnectChannel()
  const [allowedNumbers, setAllowedNumbers] = useState('')
  const [autoReply, setAutoReply] = useState(false)
  const [autoReplyInstructions, setAutoReplyInstructions] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const shouldPollQR = connecting || connectionState === 'connecting'
  const { data: qrData } = useWhatsAppQR(shouldPollQR)

  const connected = connectedProp || qrData?.state === 'connected'

  useEffect(() => {
    if (qrData?.state === 'connected') {
      setConnecting(false)
      queryClient.invalidateQueries({ queryKey: ['bot-channels'] })
    }
    if (qrData?.state === 'disconnected' && qrData?.error) setConnecting(false)
  }, [qrData?.state, qrData?.error, queryClient])

  useEffect(() => {
    if (cfg?.whatsapp && !loaded) {
      setAllowedNumbers(cfg.whatsapp.allowedNumbers || '')
      setAutoReply(cfg.whatsapp.autoReply ?? false)
      setAutoReplyInstructions(cfg.whatsapp.autoReplyInstructions || '')
      setLoaded(true)
    }
  }, [cfg])

  const handleSave = () => {
    saveConfig.mutate(
      { channel: 'whatsapp', config: { allowedNumbers, autoReply, autoReplyInstructions } },
      {
        onSuccess: () => toast.success('WhatsApp config saved'),
        onError: () => toast.error('Failed to save'),
      },
    )
  }

  const handleConnect = () => {
    setConnecting(true)
    connect.mutate('whatsapp', {
      onSuccess: () => toast.success('WhatsApp starting... wait for QR code'),
      onError: (e) => {
        toast.error(e.message)
        setConnecting(false)
      },
    })
  }

  const hasQR = !!qrData?.qr
  const hasError = !!qrData?.error
  const isWaiting = shouldPollQR && !hasQR && !hasError && !connected

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Click Connect, then scan the QR code with your phone: WhatsApp &gt; Settings &gt; Linked Devices &gt; Link a
        Device. Auth is saved locally — you only need to scan once.
      </p>

      {hasQR && !connected && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium text-primary">Scan this QR code with WhatsApp</p>
          <img src={qrData!.qr!} alt="WhatsApp QR Code" className="w-56 h-56 rounded-lg bg-white p-2" />
          <p className="text-xs text-muted-foreground">
            QR refreshes every ~20s. Open WhatsApp &gt; Linked Devices &gt; Link.
          </p>
        </div>
      )}

      {isWaiting && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          <p className="text-sm text-amber-300">Connecting to WhatsApp servers... QR code will appear shortly</p>
        </div>
      )}

      {hasError && !connected && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <p className="text-sm text-red-300">{qrData!.error}</p>
        </div>
      )}

      {connected && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <p className="text-sm text-emerald-300">WhatsApp connected and ready</p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Allowed Numbers</label>
        <Input
          value={allowedNumbers}
          onChange={(e) => setAllowedNumbers(e.target.value)}
          placeholder="33612345678, 4915123456789"
        />
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Comma-separated phone numbers with country code (no + or spaces). Leave empty to allow all.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-secondary p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Auto-Reply</p>
            <p className="text-[10px] text-muted-foreground">
              When ON, the AI responds automatically to incoming messages
            </p>
          </div>
          <button
            onClick={() => setAutoReply(!autoReply)}
            className={`relative h-5 w-9 rounded-full transition-colors ${autoReply ? 'bg-primary' : 'bg-secondary'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background transition-transform ${autoReply ? 'translate-x-4' : ''}`}
            />
          </button>
        </div>
        {autoReply && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Instructions</label>
            <Textarea
              value={autoReplyInstructions}
              onChange={(e) => setAutoReplyInstructions(e.target.value)}
              placeholder={
                "e.g. I'm a dentist. Respond to appointment requests politely. Available Monday-Friday 9am-5pm. For emergencies, tell them to call 0612345678."
              }
              rows={4}
              className="text-sm"
            />
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Tell the AI how to respond — your role, tone, rules, hours, etc.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saveConfig.isPending}>
          <Save size={14} className="mr-1.5" />
          {saveConfig.isPending ? 'Saving...' : 'Save'}
        </Button>
        {connected ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              disconnect.mutate('whatsapp', {
                onSuccess: () => {
                  toast.success('WhatsApp disconnected')
                  setConnecting(false)
                },
                onError: (e) => toast.error(e.message),
              })
            }
            disabled={disconnect.isPending}
          >
            Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            variant="default"
            onClick={handleConnect}
            disabled={connect.isPending || (shouldPollQR && !hasError)}
          >
            {connect.isPending ? 'Starting...' : shouldPollQR && !hasError ? 'Waiting for QR...' : 'Connect'}
          </Button>
        )}
      </div>
    </div>
  )
}
