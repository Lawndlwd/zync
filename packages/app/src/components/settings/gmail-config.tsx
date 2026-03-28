import { useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useChannelConfig, useDisconnectChannel, useSaveChannelConfig } from '@/hooks/useBot'

const GOOGLE_SERVICES = [
  { id: 'gmail', label: 'Gmail', api: 'Gmail API' },
  { id: 'calendar', label: 'Calendar', api: 'Google Calendar API' },
  { id: 'drive', label: 'Drive', api: 'Google Drive API' },
  { id: 'contacts', label: 'Contacts', api: 'People API' },
  { id: 'youtube', label: 'YouTube', api: 'YouTube Data API v3' },
  { id: 'tasks', label: 'Tasks', api: 'Tasks API' },
]

export function GmailConfig({ connected }: { connected: boolean }) {
  const queryClient = useQueryClient()
  const { data: cfg } = useChannelConfig()
  const saveConfig = useSaveChannelConfig()
  const disconnect = useDisconnectChannel()
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [enabledServices, setEnabledServices] = useState<string[]>(['gmail'])
  const [loaded, setLoaded] = useState(false)
  const [authorizing, setAuthorizing] = useState(false)
  const [needsReauth, setNeedsReauth] = useState(false)

  useEffect(() => {
    if (cfg?.gmail && !loaded) {
      setClientId(cfg.gmail.clientId || '')
      setEnabledServices(cfg.gmail.enabledServices || ['gmail'])
      setLoaded(true)
    }
  }, [cfg])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail') === 'authorized') {
      toast.success('Google connected!')
      queryClient.invalidateQueries({ queryKey: ['channel-config'] })
      queryClient.invalidateQueries({ queryKey: ['bot-channels'] })
      window.history.replaceState({}, '', window.location.pathname)
    }
    const gmailError = params.get('gmail_error')
    if (gmailError) {
      const msg =
        gmailError === 'access_denied' ? 'Google authorization was denied' : `Google auth failed: ${gmailError}`
      toast.error(msg)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [queryClient])

  const toggleService = (svcId: string) => {
    setEnabledServices((prev) => {
      const next = prev.includes(svcId) ? prev.filter((s) => s !== svcId) : [...prev, svcId]
      if (!prev.includes(svcId) && connected) {
        setNeedsReauth(true)
      }
      return next
    })
  }

  const handleSave = () => {
    const payload: Record<string, unknown> = { clientId, enabledServices }
    if (clientSecret) payload.clientSecret = clientSecret
    saveConfig.mutate(
      { channel: 'gmail', config: payload },
      {
        onSuccess: () => toast.success('Google config saved'),
        onError: () => toast.error('Failed to save'),
      },
    )
  }

  const handleAuthorize = async () => {
    const payload: Record<string, unknown> = { clientId, enabledServices }
    if (clientSecret) payload.clientSecret = clientSecret
    setAuthorizing(true)
    saveConfig.mutate(
      { channel: 'gmail', config: payload },
      {
        onSuccess: async () => {
          try {
            const svcParam = enabledServices.join(',')
            const res = await fetch(`/api/bot/channels/gmail/auth-url?services=${svcParam}`)
            const data = await res.json()
            if (data.url) {
              window.location.href = data.url
            } else {
              toast.error(data.error || 'Failed to get auth URL')
              setAuthorizing(false)
            }
          } catch {
            toast.error('Failed to get auth URL')
            setAuthorizing(false)
          }
        },
        onError: () => {
          toast.error('Failed to save config')
          setAuthorizing(false)
        },
      },
    )
  }

  if (connected && !needsReauth) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-400">Google connected ({enabledServices.join(', ')})</span>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Enabled services</p>
          <div className="flex flex-wrap gap-2">
            {GOOGLE_SERVICES.map((svc) => (
              <button
                key={svc.id}
                onClick={() => toggleService(svc.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  enabledServices.includes(svc.id)
                    ? 'bg-primary text-white'
                    : 'bg-secondary text-muted-foreground hover:bg-accent'
                }`}
              >
                {svc.label}
              </button>
            ))}
          </div>
        </div>

        {needsReauth && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <p className="text-xs text-amber-300">
              New services enabled — re-authorization needed for expanded access.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saveConfig.isPending}>
            <Save size={14} className="mr-1.5" />
            {saveConfig.isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              disconnect.mutate('gmail', {
                onSuccess: () => {
                  toast.success('Google disconnected')
                  queryClient.invalidateQueries({ queryKey: ['bot-channels'] })
                },
                onError: (e) => toast.error(e.message),
              })
            }
            disabled={disconnect.isPending}
          >
            Disconnect
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-muted-foreground">Setup:</p>
        <ol className="list-decimal pl-4 space-y-0.5">
          <li>
            Go to <span className="text-primary">console.cloud.google.com</span> and create a project
          </li>
          <li>
            Enable the APIs you want (APIs &amp; Services &gt; Library):
            <span className="text-muted-foreground">
              {' '}
              Gmail API, Google Calendar API, Google Drive API, People API, Tasks API, YouTube Data API v3
            </span>
          </li>
          <li>
            Go to <span className="text-foreground">Credentials</span> &gt; Create Credentials &gt; OAuth client ID
          </li>
          <li>
            Application type: <span className="text-foreground">Web application</span>
          </li>
          <li>
            Add redirect URI:{' '}
            <code className="text-foreground bg-secondary px-1 rounded">
              http://localhost:3001/api/bot/channels/gmail/callback
            </code>
          </li>
          <li>
            Copy the <span className="text-foreground">Client ID</span> and{' '}
            <span className="text-foreground">Client Secret</span> below
          </li>
        </ol>
      </div>

      <div className="grid gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Client ID</label>
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="xxxx.apps.googleusercontent.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Client Secret
            {cfg?.gmail?.hasClientSecret && (
              <Badge variant="success" className="ml-2 text-[10px]">
                saved
              </Badge>
            )}
          </label>
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={cfg?.gmail?.hasClientSecret ? 'Already saved — enter to replace' : 'GOCSPX-...'}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Services to enable</p>
        <div className="flex flex-wrap gap-2">
          {GOOGLE_SERVICES.map((svc) => (
            <button
              key={svc.id}
              onClick={() => toggleService(svc.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                enabledServices.includes(svc.id)
                  ? 'bg-primary text-white'
                  : 'bg-secondary text-muted-foreground hover:bg-accent'
              }`}
            >
              {svc.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Only enable APIs you have activated in Google Cloud Console.
        </p>
      </div>

      {needsReauth && connected && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-xs text-amber-300">New services selected — click Authorize to grant expanded access.</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saveConfig.isPending}>
          <Save size={14} className="mr-1.5" />
          {saveConfig.isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button size="sm" variant="default" onClick={handleAuthorize} disabled={authorizing || !clientId}>
          {authorizing ? 'Redirecting...' : 'Authorize with Google'}
        </Button>
      </div>
    </div>
  )
}
