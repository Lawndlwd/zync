import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Radio, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useBotChannels,
  useChannelConfig,
  useSaveChannelConfig,
  useConnectChannel,
  useDisconnectChannel,
  useWhatsAppQR,
} from '@/hooks/useBot'
import { useTelegramConfig, useSaveTelegramConfig } from '@/hooks/useTelegram'

function TelegramExtendedConfig() {
  const { data: tgCfg } = useTelegramConfig()
  const saveTgConfig = useSaveTelegramConfig()
  const [channelId, setChannelId] = useState('')
  const [dmAutoReply, setDmAutoReply] = useState(false)
  const [supportRateLimit, setSupportRateLimit] = useState(10)
  const [tgLoaded, setTgLoaded] = useState(false)

  useEffect(() => {
    if (tgCfg && !tgLoaded) {
      setChannelId(tgCfg.channelId || '')
      setDmAutoReply(tgCfg.dmAutoReply ?? false)
      setSupportRateLimit(tgCfg.supportRateLimit ?? 10)
      setTgLoaded(true)
    }
  }, [tgCfg])

  const handleSaveTg = () => {
    saveTgConfig.mutate({ channelId, dmAutoReply, supportRateLimit }, {
      onSuccess: () => toast.success('Telegram extended config saved'),
      onError: () => toast.error('Failed to save extended config'),
    })
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="text-xs font-medium text-zinc-400">Extended Settings</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Channel ID</label>
          <Input
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder="-1001234567890"
          />
          <p className="mt-0.5 text-[10px] text-zinc-600">Telegram channel/group ID for cross-posting.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Support Rate Limit</label>
          <Input
            type="number"
            value={supportRateLimit}
            onChange={(e) => setSupportRateLimit(Number(e.target.value))}
            placeholder="10"
            min={1}
          />
          <p className="mt-0.5 text-[10px] text-zinc-600">Max auto-replies per user per minute.</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-300">DM Auto Reply</p>
          <p className="text-[10px] text-zinc-600">Automatically reply to incoming DMs</p>
        </div>
        <button
          onClick={() => setDmAutoReply(!dmAutoReply)}
          className={`relative h-5 w-9 rounded-full transition-colors ${dmAutoReply ? 'bg-indigo-600' : 'bg-zinc-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${dmAutoReply ? 'translate-x-4' : ''}`} />
        </button>
      </div>
      <Button size="sm" onClick={handleSaveTg} disabled={saveTgConfig.isPending}>
        <Save size={14} className="mr-1.5" />{saveTgConfig.isPending ? 'Saving...' : 'Save Extended'}
      </Button>
    </div>
  )
}

export function TelegramConfig({ connected }: { connected: boolean }) {
  const { data: cfg } = useChannelConfig()
  const saveConfig = useSaveChannelConfig()
  const connect = useConnectChannel()
  const disconnect = useDisconnectChannel()
  const [botToken, setBotToken] = useState('')
  const [allowedUsers, setAllowedUsers] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (cfg?.telegram && !loaded) {
      setBotToken(cfg.telegram.hasBotToken ? '' : '')
      setAllowedUsers(cfg.telegram.allowedUsers || '')
      setLoaded(true)
    }
  }, [cfg])

  const handleSave = () => {
    const payload: Record<string, unknown> = { allowedUsers }
    if (botToken) payload.botToken = botToken
    saveConfig.mutate({ channel: 'telegram', config: payload }, {
      onSuccess: () => toast.success('Telegram config saved'),
      onError: () => toast.error('Failed to save'),
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Get a bot token from <span className="text-indigo-400">@BotFather</span> on Telegram. Send <span className="font-mono">/newbot</span> and follow the prompts.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Bot Token</label>
          <Input
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder={cfg?.telegram?.hasBotToken ? '••••' + (cfg.telegram.botToken || '') : '123456:ABC-DEF...'}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Allowed User IDs</label>
          <Input
            value={allowedUsers}
            onChange={(e) => setAllowedUsers(e.target.value)}
            placeholder="123456789, 987654321"
          />
          <p className="mt-0.5 text-[10px] text-zinc-600">Comma-separated Telegram user IDs. Leave empty for all.</p>
        </div>
      </div>
      <TelegramExtendedConfig />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saveConfig.isPending}>
          <Save size={14} className="mr-1.5" />{saveConfig.isPending ? 'Saving...' : 'Save'}
        </Button>
        {connected ? (
          <Button size="sm" variant="destructive" onClick={() => disconnect.mutate('telegram', {
            onSuccess: () => toast.success('Telegram disconnected'),
            onError: (e) => toast.error(e.message),
          })} disabled={disconnect.isPending}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" variant="default" onClick={() => connect.mutate('telegram', {
            onSuccess: () => toast.success('Telegram connected!'),
            onError: (e) => toast.error(e.message),
          })} disabled={connect.isPending}>
            {connect.isPending ? 'Connecting...' : 'Connect'}
          </Button>
        )}
      </div>
    </div>
  )
}

export function WhatsAppConfig({ connected: connectedProp, connectionState }: { connected: boolean; connectionState: string }) {
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
    saveConfig.mutate({ channel: 'whatsapp', config: { allowedNumbers, autoReply, autoReplyInstructions } }, {
      onSuccess: () => toast.success('WhatsApp config saved'),
      onError: () => toast.error('Failed to save'),
    })
  }

  const handleConnect = () => {
    setConnecting(true)
    connect.mutate('whatsapp', {
      onSuccess: () => toast.success('WhatsApp starting... wait for QR code'),
      onError: (e) => { toast.error(e.message); setConnecting(false) },
    })
  }

  const hasQR = !!qrData?.qr
  const hasError = !!qrData?.error
  const isWaiting = shouldPollQR && !hasQR && !hasError && !connected

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Click Connect, then scan the QR code with your phone: WhatsApp &gt; Settings &gt; Linked Devices &gt; Link a Device.
        Auth is saved locally — you only need to scan once.
      </p>

      {hasQR && !connected && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
          <p className="text-sm font-medium text-indigo-300">Scan this QR code with WhatsApp</p>
          <img src={qrData!.qr!} alt="WhatsApp QR Code" className="w-56 h-56 rounded-lg bg-white p-2" />
          <p className="text-xs text-zinc-500">QR refreshes every ~20s. Open WhatsApp &gt; Linked Devices &gt; Link.</p>
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
        <label className="mb-1 block text-xs font-medium text-zinc-400">Allowed Numbers</label>
        <Input
          value={allowedNumbers}
          onChange={(e) => setAllowedNumbers(e.target.value)}
          placeholder="33612345678, 4915123456789"
        />
        <p className="mt-0.5 text-[10px] text-zinc-600">Comma-separated phone numbers with country code (no + or spaces). Leave empty to allow all.</p>
      </div>

      <div className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-300">Auto-Reply</p>
            <p className="text-[10px] text-zinc-600">When ON, the AI responds automatically to incoming messages</p>
          </div>
          <button
            onClick={() => setAutoReply(!autoReply)}
            className={`relative h-5 w-9 rounded-full transition-colors ${autoReply ? 'bg-indigo-600' : 'bg-zinc-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${autoReply ? 'translate-x-4' : ''}`} />
          </button>
        </div>
        {autoReply && (
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Instructions</label>
            <Textarea
              value={autoReplyInstructions}
              onChange={(e) => setAutoReplyInstructions(e.target.value)}
              placeholder={"e.g. I'm a dentist. Respond to appointment requests politely. Available Monday-Friday 9am-5pm. For emergencies, tell them to call 0612345678."}
              rows={4}
              className="text-sm"
            />
            <p className="mt-0.5 text-[10px] text-zinc-600">Tell the AI how to respond — your role, tone, rules, hours, etc.</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saveConfig.isPending}>
          <Save size={14} className="mr-1.5" />{saveConfig.isPending ? 'Saving...' : 'Save'}
        </Button>
        {connected ? (
          <Button size="sm" variant="destructive" onClick={() => disconnect.mutate('whatsapp', {
            onSuccess: () => { toast.success('WhatsApp disconnected'); setConnecting(false) },
            onError: (e) => toast.error(e.message),
          })} disabled={disconnect.isPending}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" variant="default" onClick={handleConnect} disabled={connect.isPending || (shouldPollQR && !hasError)}>
            {connect.isPending ? 'Starting...' : shouldPollQR && !hasError ? 'Waiting for QR...' : 'Connect'}
          </Button>
        )}
      </div>
    </div>
  )
}

const GOOGLE_SERVICES = [
  { id: 'gmail', label: 'Gmail', api: 'Gmail API' },
  { id: 'calendar', label: 'Calendar', api: 'Google Calendar API' },
  { id: 'drive', label: 'Drive', api: 'Google Drive API' },
  { id: 'contacts', label: 'Contacts', api: 'People API' },
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
      const msg = gmailError === 'access_denied' ? 'Google authorization was denied' : `Google auth failed: ${gmailError}`
      toast.error(msg)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [queryClient])

  const toggleService = (svcId: string) => {
    setEnabledServices(prev => {
      const next = prev.includes(svcId)
        ? prev.filter(s => s !== svcId)
        : [...prev, svcId]
      // If we're adding a new service while already authorized, need re-auth
      if (!prev.includes(svcId) && connected) {
        setNeedsReauth(true)
      }
      return next
    })
  }

  const handleSave = () => {
    const payload: Record<string, unknown> = { clientId, enabledServices }
    if (clientSecret) payload.clientSecret = clientSecret
    saveConfig.mutate({ channel: 'gmail', config: payload }, {
      onSuccess: () => toast.success('Google config saved'),
      onError: () => toast.error('Failed to save'),
    })
  }

  const handleAuthorize = async () => {
    const payload: Record<string, unknown> = { clientId, enabledServices }
    if (clientSecret) payload.clientSecret = clientSecret
    setAuthorizing(true)
    saveConfig.mutate({ channel: 'gmail', config: payload }, {
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
    })
  }

  if (connected && !needsReauth) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-400">Google connected ({enabledServices.join(', ')})</span>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-400">Enabled services</p>
          <div className="flex flex-wrap gap-2">
            {GOOGLE_SERVICES.map(svc => (
              <button
                key={svc.id}
                onClick={() => toggleService(svc.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  enabledServices.includes(svc.id)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {svc.label}
              </button>
            ))}
          </div>
        </div>

        {needsReauth && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <p className="text-xs text-amber-300">New services enabled — re-authorization needed for expanded access.</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saveConfig.isPending}>
            <Save size={14} className="mr-1.5" />{saveConfig.isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => disconnect.mutate('gmail', {
            onSuccess: () => { toast.success('Google disconnected'); queryClient.invalidateQueries({ queryKey: ['bot-channels'] }) },
            onError: (e) => toast.error(e.message),
          })} disabled={disconnect.isPending}>
            Disconnect
          </Button>
        </div>
      </div>
    )
  }


  return (
    <div className="space-y-3">
      <div className="text-xs text-zinc-500 space-y-1">
        <p className="font-medium text-zinc-400">Setup:</p>
        <ol className="list-decimal pl-4 space-y-0.5">
          <li>Go to <span className="text-indigo-400">console.cloud.google.com</span> and create a project</li>
          <li>Enable the APIs you want (APIs &amp; Services &gt; Library):
            <span className="text-zinc-400"> Gmail API, Google Calendar API, Google Drive API, People API, Tasks API</span>
          </li>
          <li>Go to <span className="text-zinc-300">Credentials</span> &gt; Create Credentials &gt; OAuth client ID</li>
          <li>Application type: <span className="text-zinc-300">Web application</span></li>
          <li>Add redirect URI: <code className="text-zinc-300 bg-zinc-800 px-1 rounded">http://localhost:3001/api/bot/channels/gmail/callback</code></li>
          <li>Copy the <span className="text-zinc-300">Client ID</span> and <span className="text-zinc-300">Client Secret</span> below</li>
        </ol>
      </div>

      <div className="grid gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Client ID</label>
          <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            Client Secret
            {cfg?.gmail?.hasClientSecret && <Badge variant="success" className="ml-2 text-[10px]">saved</Badge>}
          </label>
          <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder={cfg?.gmail?.hasClientSecret ? 'Already saved — enter to replace' : 'GOCSPX-...'} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-400">Services to enable</p>
        <div className="flex flex-wrap gap-2">
          {GOOGLE_SERVICES.map(svc => (
            <button
              key={svc.id}
              onClick={() => toggleService(svc.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                enabledServices.includes(svc.id)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {svc.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600">Only enable APIs you have activated in Google Cloud Console.</p>
      </div>

      {needsReauth && connected && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-xs text-amber-300">New services selected — click Authorize to grant expanded access.</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saveConfig.isPending}>
          <Save size={14} className="mr-1.5" />{saveConfig.isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button size="sm" variant="default" onClick={handleAuthorize} disabled={authorizing || !clientId}>
          {authorizing ? 'Redirecting...' : 'Authorize with Google'}
        </Button>
      </div>
    </div>
  )
}

export function ChannelsSettingsCard() {
  const { data: channels, isLoading } = useBotChannels()
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio size={16} />
          Channels
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : (
          (channels ?? []).map((ch) => {
            const isExpanded = expandedChannel === ch.channel
            return (
              <div key={ch.channel} className="rounded-lg border border-white/[0.08] bg-white/[0.03]">
                <button
                  onClick={() => setExpandedChannel(isExpanded ? null : ch.channel)}
                  className="flex items-center gap-3 p-3 w-full text-left"
                >
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                    ch.connected ? 'bg-emerald-400'
                    : ch.connectionState === 'connecting' ? 'bg-amber-400 animate-pulse'
                    : ch.configured ? 'bg-amber-400'
                    : 'bg-zinc-600'
                  }`} />
                  <p className="text-sm font-medium text-zinc-300 capitalize flex-1">{ch.channel}</p>
                  <Badge variant={ch.connected ? 'success' : ch.configured ? 'primary' : 'default'} className="text-[10px]">
                    {ch.connected ? 'online' : ch.connectionState === 'connecting' ? 'connecting' : ch.configured ? 'ready' : 'off'}
                  </Badge>
                  <span className="text-zinc-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/[0.06] px-3 py-3">
                    {ch.channel === 'telegram' && <TelegramConfig connected={ch.connected} />}
                    {ch.channel === 'whatsapp' && <WhatsAppConfig connected={ch.connected} connectionState={ch.connectionState} />}
                    {ch.channel === 'gmail' && <GmailConfig connected={ch.connected} />}
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
