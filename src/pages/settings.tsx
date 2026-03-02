import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSettingsStore } from '@/store/settings'
import { BoardPicker } from '@/components/jira/board-picker'
import { MemberPicker } from '@/components/gitlab/member-picker'
import { fetchServerSettings } from '@/services/jira'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TagInput } from '@/components/ui/tag-input'
import {
  RotateCcw, Download, Trash2, Plus, Search, Brain, Clock, Wrench,
  Radio, Zap, CalendarClock, Shield, RefreshCw, Play, Save,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useBotMemories,
  useCreateMemory,
  useDeleteMemory,
  useBotSchedules,
  useCreateSchedule,
  useDeleteSchedule,
  useToggleSchedule,
  useBotTools,
  useBotChannels,
  useChannelConfig,
  useSaveChannelConfig,
  useConnectChannel,
  useDisconnectChannel,
  useWhatsAppQR,
  useBotSkills,
  useReloadSkills,
  useBriefingConfig,
  useUpdateBriefingConfig,
  useTriggerBriefing,
  useBotToolConfig,
  useUpdateToolConfig,
} from '@/hooks/useBot'
import { OpenCodeSettings } from '@/components/opencode/OpenCodeSettings'
import type { BriefingConfig, ToolConfig } from '@/types/bot'

// --- Shared field ---

function SettingField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  envValue,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  envValue?: string
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-zinc-400">
        {label}
        {envValue && envValue !== '••••••••' && (
          <Badge variant="primary" className="text-[10px]">from .env</Badge>
        )}
        {envValue === '••••••••' && (
          <Badge variant="success" className="text-[10px]">configured in .env</Badge>
        )}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={envValue && envValue !== '••••••••' ? envValue : placeholder}
      />
    </div>
  )
}

// --- GitLab settings card ---

function GitLabSettingsCard({ envConfig }: { envConfig: Awaited<ReturnType<typeof fetchServerSettings>> | null }) {
  const { settings, updateGitlab } = useSettingsStore()
  const [baseUrl, setBaseUrl] = useState(settings.gitlab.baseUrl)
  const [pat, setPat] = useState(settings.gitlab.pat)
  const [testResult, setTestResult] = useState<{ ok: boolean; name?: string; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (envConfig?.gitlab?.baseUrl && !baseUrl) setBaseUrl(envConfig.gitlab.baseUrl)
  }, [envConfig])

  const saveConfig = async () => {
    if (!baseUrl || !pat) {
      toast.error('Both URL and PAT are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/gitlab/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, pat }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Save failed')
      }
      updateGitlab({ baseUrl })
      toast.success('GitLab config saved')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    if (baseUrl && pat && pat !== '••••••••') {
      await saveConfig()
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/gitlab/user')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `${res.status} ${res.statusText}`)
      }
      const user = await res.json()
      setTestResult({ ok: true, name: user.name || user.username })
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  const localRepoPaths = settings.gitlab.localRepoPaths || {}
  const [newRepoId, setNewRepoId] = useState('')
  const [newRepoPath, setNewRepoPath] = useState('')

  const addRepoPath = () => {
    if (!newRepoId || !newRepoPath) return
    updateGitlab({ localRepoPaths: { ...localRepoPaths, [newRepoId]: newRepoPath } })
    setNewRepoId('')
    setNewRepoPath('')
  }

  const removeRepoPath = (id: string) => {
    const updated = { ...localRepoPaths }
    delete updated[id]
    updateGitlab({ localRepoPaths: updated })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitLab Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingField
            label="Base URL"
            value={baseUrl}
            onChange={setBaseUrl}
            placeholder="https://gitlab.internal.example.com"
            envValue={envConfig?.gitlab?.baseUrl}
          />
          <SettingField
            label="Personal Access Token"
            value={pat}
            onChange={setPat}
            type="password"
            placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
            envValue={envConfig?.gitlab?.pat}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={saveConfig} disabled={saving || !baseUrl || !pat}>
            <Save size={14} className="mr-1.5" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" variant="default" onClick={testConnection} disabled={testing}>
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
          {testResult?.ok && (
            <Badge variant="success">Connected as {testResult.name}</Badge>
          )}
          {testResult && !testResult.ok && (
            <Badge variant="danger">Failed: {testResult.error}</Badge>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            Your GitLab Username
          </label>
          <p className="mb-2 text-xs text-zinc-600">
            Select yourself from the project members. Used to filter "To Review" and "Mine" MRs.
          </p>
          <MemberPicker
            value={settings.gitlab.username || ''}
            onChange={(username) => updateGitlab({ username })}
            projectId={settings.gitlab.defaultProjectId}
            className="w-72"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">
            Local Repository Paths
          </label>
          <p className="mb-2 text-xs text-zinc-600">
            Map GitLab project IDs to local filesystem paths for git operations.
          </p>
          {Object.entries(localRepoPaths).length > 0 && (
            <div className="mb-2 space-y-1">
              {Object.entries(localRepoPaths).map(([id, path]) => (
                <div key={id} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-indigo-400 w-24 truncate">{id}</span>
                  <span className="text-zinc-500 flex-1 truncate">{path}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeRepoPath(id)}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={newRepoId}
              onChange={(e) => setNewRepoId(e.target.value)}
              placeholder="Project ID"
              className="w-32"
            />
            <Input
              value={newRepoPath}
              onChange={(e) => setNewRepoPath(e.target.value)}
              placeholder="/path/to/local/repo"
              className="flex-1"
            />
            <Button size="sm" variant="ghost" onClick={addRepoPath}>
              <Plus size={14} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Channels Card ---

function TelegramConfig({ connected }: { connected: boolean }) {
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

function WhatsAppConfig({ connected: connectedProp, connectionState }: { connected: boolean; connectionState: string }) {
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

  // Poll QR only while actively connecting (not when disconnected or already connected)
  const shouldPollQR = connecting || connectionState === 'connecting'
  const { data: qrData } = useWhatsAppQR(shouldPollQR)

  // Use QR endpoint state as real-time source of truth (polled every 3s)
  const connected = connectedProp || qrData?.state === 'connected'

  // Stop polling and refresh channels once connected or errored out
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

      {/* QR Code display */}
      {hasQR && !connected && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
          <p className="text-sm font-medium text-indigo-300">Scan this QR code with WhatsApp</p>
          <img src={qrData!.qr!} alt="WhatsApp QR Code" className="w-56 h-56 rounded-lg bg-white p-2" />
          <p className="text-xs text-zinc-500">QR refreshes every ~20s. Open WhatsApp &gt; Linked Devices &gt; Link.</p>
        </div>
      )}

      {/* Waiting for QR */}
      {isWaiting && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          <p className="text-sm text-amber-300">Connecting to WhatsApp servers... QR code will appear shortly</p>
        </div>
      )}

      {/* Error message */}
      {hasError && !connected && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <p className="text-sm text-red-300">{qrData!.error}</p>
        </div>
      )}

      {/* Connected */}
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

      {/* Auto-Reply */}
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

function GmailConfig({ connected }: { connected: boolean }) {
  const queryClient = useQueryClient()
  const { data: cfg } = useChannelConfig()
  const saveConfig = useSaveChannelConfig()
  const connect = useConnectChannel()
  const disconnect = useDisconnectChannel()
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [authorizing, setAuthorizing] = useState(false)

  useEffect(() => {
    if (cfg?.gmail && !loaded) {
      setClientId(cfg.gmail.clientId || '')
      setLoaded(true)
    }
  }, [cfg])

  // Detect OAuth callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail') === 'authorized') {
      toast.success('Gmail connected!')
      queryClient.invalidateQueries({ queryKey: ['channel-config'] })
      queryClient.invalidateQueries({ queryKey: ['bot-channels'] })
      window.history.replaceState({}, '', window.location.pathname)
    }
    const gmailError = params.get('gmail_error')
    if (gmailError) {
      const msg = gmailError === 'access_denied' ? 'Google authorization was denied' : `Gmail auth failed: ${gmailError}`
      toast.error(msg)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [queryClient])

  const handleSave = () => {
    const payload: Record<string, unknown> = { clientId }
    if (clientSecret) payload.clientSecret = clientSecret
    saveConfig.mutate({ channel: 'gmail', config: payload }, {
      onSuccess: () => toast.success('Gmail config saved'),
      onError: () => toast.error('Failed to save'),
    })
  }

  const handleAuthorize = async () => {
    // Save credentials first, then redirect to Google
    const payload: Record<string, unknown> = { clientId }
    if (clientSecret) payload.clientSecret = clientSecret
    setAuthorizing(true)
    saveConfig.mutate({ channel: 'gmail', config: payload }, {
      onSuccess: async () => {
        try {
          const res = await fetch('/api/bot/channels/gmail/auth-url')
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

  const handleConnect = () => {
    connect.mutate('gmail', {
      onSuccess: () => toast.success('Gmail connected!'),
      onError: (e) => toast.error(e.message),
    })
  }

  const authorized = cfg?.gmail?.authorized

  if (connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-400">Gmail connected and polling</span>
        </div>
        <Button size="sm" variant="destructive" onClick={() => disconnect.mutate('gmail', {
          onSuccess: () => { toast.success('Gmail disconnected'); queryClient.invalidateQueries({ queryKey: ['bot-channels'] }) },
          onError: (e) => toast.error(e.message),
        })} disabled={disconnect.isPending}>
          Disconnect
        </Button>
      </div>
    )
  }


  return (
    <div className="space-y-3">
      <div className="text-xs text-zinc-500 space-y-1">
        <p className="font-medium text-zinc-400">Setup:</p>
        <ol className="list-decimal pl-4 space-y-0.5">
          <li>Go to <span className="text-indigo-400">console.cloud.google.com</span></li>
          <li>Enable the <span className="text-zinc-300">Gmail API</span> (APIs &amp; Services &gt; Library)</li>
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

function ChannelsCard() {
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

// --- Skills Card ---

function SkillsCard() {
  const { data: skills, isLoading } = useBotSkills()
  const reloadSkills = useReloadSkills()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap size={16} />
            Skills
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => reloadSkills.mutate(undefined, {
              onSuccess: (data) => toast.success(`Reloaded ${data.count} skill(s)`),
              onError: () => toast.error('Failed to reload skills'),
            })}
            disabled={reloadSkills.isPending}
          >
            <RefreshCw size={14} className={reloadSkills.isPending ? 'animate-spin' : ''} />
            <span className="ml-1.5 hidden sm:inline">Reload</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : !skills?.length ? (
          <p className="text-sm text-zinc-500">No skills loaded.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {skills.map((s) => (
              <div key={s.name} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                <p className="text-sm font-medium text-zinc-300">{s.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{s.description}</p>
                {s.triggers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.triggers.map((t) => (
                      <Badge key={t} variant="default" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// --- Briefings Card ---

function BriefingsCard() {
  const { data: config, isLoading } = useBriefingConfig()
  const updateConfig = useUpdateBriefingConfig()
  const triggerBriefing = useTriggerBriefing()

  const [draft, setDraft] = useState<BriefingConfig | null>(null)

  useEffect(() => {
    if (config && !draft) setDraft(config)
  }, [config])

  const handleSave = () => {
    if (!draft) return
    updateConfig.mutate(draft, {
      onSuccess: () => toast.success('Briefing config saved'),
      onError: () => toast.error('Failed to save briefing config'),
    })
  }

  const handleTrigger = (type: 'morning' | 'evening') => {
    triggerBriefing.mutate(type, {
      onSuccess: () => toast.success(`${type === 'morning' ? 'Morning briefing' : 'Evening recap'} triggered`),
      onError: () => toast.error('Failed to trigger briefing'),
    })
  }

  if (isLoading || !draft) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock size={16} />
          Proactive Briefings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
            className={`h-4 w-4 shrink-0 rounded border ${draft.enabled ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-600'}`}
          />
          <span className="text-sm text-zinc-300">Enabled</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Morning Cron</label>
            <Input
              value={draft.morningCron}
              onChange={(e) => setDraft({ ...draft, morningCron: e.target.value })}
              placeholder="0 8 * * 1-5"
              className="font-mono"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Evening Cron</label>
            <Input
              value={draft.eveningCron}
              onChange={(e) => setDraft({ ...draft, eveningCron: e.target.value })}
              placeholder="0 18 * * 1-5"
              className="font-mono"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Channel</label>
            <Input
              value={draft.channel}
              onChange={(e) => setDraft({ ...draft, channel: e.target.value })}
              placeholder="telegram"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Chat ID</label>
            <Input
              value={draft.chatId}
              onChange={(e) => setDraft({ ...draft, chatId: e.target.value })}
              placeholder="123456789"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={updateConfig.isPending}>
            <Save size={14} className="mr-1.5" />
            {updateConfig.isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" variant="default" onClick={() => handleTrigger('morning')} disabled={triggerBriefing.isPending}>
            <Play size={14} className="mr-1.5" />
            Morning
          </Button>
          <Button size="sm" variant="default" onClick={() => handleTrigger('evening')} disabled={triggerBriefing.isPending}>
            <Play size={14} className="mr-1.5" />
            Evening
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Tool Config Card ---

function ToolConfigCard() {
  const { data: config, isLoading } = useBotToolConfig()
  const updateConfig = useUpdateToolConfig()

  const [draft, setDraft] = useState<ToolConfig | null>(null)

  useEffect(() => {
    if (config && !draft) setDraft(config)
  }, [config])

  const handleSave = () => {
    if (!draft) return
    updateConfig.mutate(draft, {
      onSuccess: () => toast.success('Tool config saved'),
      onError: () => toast.error('Failed to save tool config'),
    })
  }

  if (isLoading || !draft) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield size={16} />
          Tool Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">Shell Allowlist</label>
          <p className="mb-2 text-xs text-zinc-600">Commands the AI agent can execute.</p>
          <TagInput
            value={draft.shell.allowlist}
            onChange={(allowlist) => setDraft({ ...draft, shell: { ...draft.shell, allowlist } })}
            placeholder="Add command..."
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-400">File Allowed Paths</label>
          <p className="mb-2 text-xs text-zinc-600">Directories the AI agent can read/write.</p>
          <TagInput
            value={draft.files.allowed_paths}
            onChange={(allowed_paths) => setDraft({ ...draft, files: { ...draft.files, allowed_paths } })}
            placeholder="Add path..."
          />
        </div>
        <Button size="sm" onClick={handleSave} disabled={updateConfig.isPending}>
          <Save size={14} className="mr-1.5" />
          {updateConfig.isPending ? 'Saving...' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  )
}

// --- Main page ---

export function SettingsPage() {
  const { settings, updateJira, resetSettings } = useSettingsStore()
  const [envConfig, setEnvConfig] = useState<Awaited<ReturnType<typeof fetchServerSettings>> | null>(null)

  useEffect(() => {
    fetchServerSettings()
      .then(setEnvConfig)
      .catch(() => { })
  }, [])

  const handleSyncFromEnv = () => {
    if (!envConfig) return
    updateJira({
      baseUrl: envConfig.jira.baseUrl || settings.jira.baseUrl,
      email: envConfig.jira.email || settings.jira.email,
      projectKey: envConfig.jira.projectKey || settings.jira.projectKey,
    })
    toast.success('Settings synced from server .env')
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
          <p className="text-sm text-zinc-500">Configure your integrations</p>
        </div>
        <div className="flex gap-2">
          {envConfig && (
            <Button variant="default" size="sm" onClick={handleSyncFromEnv}>
              <Download size={14} />
              Sync from .env
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={resetSettings}>
            <RotateCcw size={14} />
            Reset
          </Button>
        </div>
      </div>

      {envConfig && (
        <Card className="mb-6 border-indigo-500/30 bg-indigo-950/10">
          <CardContent className="py-3">
            <p className="text-sm text-indigo-300">
              Server .env detected. Fields marked <Badge variant="primary" className="text-[10px]">from .env</Badge> show values configured on the server.
              The backend always uses .env for API calls. These UI settings are for display and client-side features.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">

        {/* 1. OpenCode — connection + model selection */}
        <OpenCodeSettings />

        {/* 2. Channels */}
        <ChannelsCard />

        {/* 3. Jira */}
        <Card>
          <CardHeader>
            <CardTitle>Jira Configuration</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <SettingField
              label="Base URL"
              value={settings.jira.baseUrl}
              onChange={(v) => updateJira({ baseUrl: v })}
              placeholder="https://your-domain.atlassian.net"
              envValue={envConfig?.jira.baseUrl}
            />
            <SettingField
              label="Email"
              value={settings.jira.email}
              onChange={(v) => updateJira({ email: v })}
              placeholder="you@company.com"
              envValue={envConfig?.jira.email}
            />
            <SettingField
              label="Project Key"
              value={settings.jira.projectKey}
              onChange={(v) => updateJira({ projectKey: v })}
              placeholder="PROJ"
              envValue={envConfig?.jira.projectKey}
            />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Board</label>
              <BoardPicker
                value={settings.jira.boardId}
                onChange={(id) => updateJira({ boardId: id })}
              />
            </div>
            <div className="sm:col-span-2">
              <SettingField
                label="Default JQL"
                value={settings.jira.defaultJql}
                onChange={(v) => updateJira({ defaultJql: v })}
                placeholder="assignee = currentUser() ORDER BY updated DESC"
              />
            </div>
          </CardContent>
        </Card>

        {/* 4. GitLab */}
        <GitLabSettingsCard envConfig={envConfig} />

        {/* 5. Skills */}
        <SkillsCard />

        {/* 6. Briefings */}
        <BriefingsCard />

        {/* 7. Tool Config */}
        <ToolConfigCard />

        {/* 8. Agent Memories */}
        <AgentMemoriesCard />

        {/* 9. Agent Schedules */}
        <AgentSchedulesCard />

        {/* 10. Agent Tools */}
        <AgentToolsCard />
      </div>
    </div>
  )
}

// --- Agent Memories Card ---

function AgentMemoriesCard() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const { data: memories, isLoading } = useBotMemories(debouncedSearch || undefined)
  const createMemory = useCreateMemory()
  const deleteMemory = useDeleteMemory()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleAdd = () => {
    if (!newContent.trim()) return
    createMemory.mutate(
      { content: newContent.trim(), category: newCategory.trim() || undefined },
      {
        onSuccess: () => {
          setNewContent('')
          setNewCategory('')
          toast.success('Memory added')
        },
        onError: () => toast.error('Failed to add memory'),
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain size={16} />
          Agent Memories
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memories..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Input
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Memory content..."
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Category"
            className="w-32"
          />
          <Button size="sm" onClick={handleAdd} disabled={!newContent.trim() || createMemory.isPending}>
            <Plus size={14} />
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : !memories?.length ? (
            <p className="text-sm text-zinc-500">No memories found.</p>
          ) : (
            memories.map((m) => (
              <div key={m.id} className="flex items-start gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300">{m.content}</p>
                  <Badge variant="default" className="mt-1 text-[10px]">{m.category}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-zinc-500 hover:text-red-400"
                  onClick={() => deleteMemory.mutate(m.id, {
                    onSuccess: () => toast.success('Memory deleted'),
                    onError: () => toast.error('Failed to delete'),
                  })}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// --- Agent Schedules Card ---

function AgentSchedulesCard() {
  const [cronExpr, setCronExpr] = useState('')
  const [prompt, setPrompt] = useState('')
  const [chatId, setChatId] = useState('')

  const { data: schedules, isLoading } = useBotSchedules()
  const createSchedule = useCreateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const toggleSchedule = useToggleSchedule()

  const handleAdd = () => {
    if (!cronExpr.trim() || !prompt.trim() || !chatId.trim()) return
    createSchedule.mutate(
      { cronExpression: cronExpr.trim(), prompt: prompt.trim(), chatId: parseInt(chatId) },
      {
        onSuccess: () => {
          setCronExpr('')
          setPrompt('')
          setChatId('')
          toast.success('Schedule created')
        },
        onError: () => toast.error('Failed to create schedule'),
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock size={16} />
          Agent Schedules
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          <Input
            value={cronExpr}
            onChange={(e) => setCronExpr(e.target.value)}
            placeholder="Cron (0 9 * * *)"
          />
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Prompt..."
            className="sm:col-span-2"
          />
          <div className="flex gap-2">
            <Input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Chat ID"
              type="number"
            />
            <Button size="sm" onClick={handleAdd} disabled={!cronExpr.trim() || !prompt.trim() || !chatId.trim() || createSchedule.isPending}>
              <Plus size={14} />
            </Button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : !schedules?.length ? (
            <p className="text-sm text-zinc-500">No schedules.</p>
          ) : (
            schedules.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                <button
                  onClick={() => toggleSchedule.mutate({ id: s.id, enabled: !s.enabled })}
                  className={`h-4 w-4 shrink-0 rounded border ${s.enabled ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-600'
                    }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 truncate">{s.prompt}</p>
                  <p className="text-xs text-zinc-500 font-mono">{s.cron_expression}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-zinc-500 hover:text-red-400"
                  onClick={() => deleteSchedule.mutate(s.id, {
                    onSuccess: () => toast.success('Schedule deleted'),
                    onError: () => toast.error('Failed to delete'),
                  })}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// --- Agent Tools Card ---

function AgentToolsCard() {
  const { data: tools, isLoading } = useBotTools()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench size={16} />
          Agent Tools
          {tools && <Badge variant="default" className="text-[10px] ml-2">{tools.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : !tools?.length ? (
            <p className="text-sm text-zinc-500">No tools available.</p>
          ) : (
            tools.map((t) => (
              <div key={t.name} className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-300">{t.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{t.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
