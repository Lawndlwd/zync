import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useChannelConfig, useConnectChannel, useDisconnectChannel, useSaveChannelConfig } from '@/hooks/useBot'
import { useSaveTelegramConfig, useTelegramConfig } from '@/hooks/useTelegram'

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
    saveTgConfig.mutate(
      { channelId, dmAutoReply, supportRateLimit },
      {
        onSuccess: () => toast.success('Telegram extended config saved'),
        onError: () => toast.error('Failed to save extended config'),
      },
    )
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-secondary p-3">
      <p className="text-xs font-medium text-muted-foreground">Extended Settings</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Channel ID</label>
          <Input value={channelId} onChange={(e) => setChannelId(e.target.value)} placeholder="-1001234567890" />
          <p className="mt-0.5 text-[10px] text-muted-foreground">Telegram channel/group ID for cross-posting.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Support Rate Limit</label>
          <Input
            type="number"
            value={supportRateLimit}
            onChange={(e) => setSupportRateLimit(Number(e.target.value))}
            placeholder="10"
            min={1}
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground">Max auto-replies per user per minute.</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">DM Auto Reply</p>
          <p className="text-[10px] text-muted-foreground">Automatically reply to incoming DMs</p>
        </div>
        <button
          onClick={() => setDmAutoReply(!dmAutoReply)}
          className={`relative h-5 w-9 rounded-full transition-colors ${dmAutoReply ? 'bg-primary' : 'bg-secondary'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background transition-transform ${dmAutoReply ? 'translate-x-4' : ''}`}
          />
        </button>
      </div>
      <Button size="sm" onClick={handleSaveTg} disabled={saveTgConfig.isPending}>
        <Save size={14} className="mr-1.5" />
        {saveTgConfig.isPending ? 'Saving...' : 'Save Extended'}
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
    saveConfig.mutate(
      { channel: 'telegram', config: payload },
      {
        onSuccess: () => toast.success('Telegram config saved'),
        onError: () => toast.error('Failed to save'),
      },
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Get a bot token from <span className="text-primary">@BotFather</span> on Telegram. Send{' '}
        <span className="font-mono">/newbot</span> and follow the prompts.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Bot Token</label>
          <Input
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder={cfg?.telegram?.hasBotToken ? `••••${cfg.telegram.botToken || ''}` : '123456:ABC-DEF...'}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Allowed User IDs</label>
          <Input
            value={allowedUsers}
            onChange={(e) => setAllowedUsers(e.target.value)}
            placeholder="123456789, 987654321"
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Comma-separated Telegram user IDs. Leave empty for all.
          </p>
        </div>
      </div>
      <TelegramExtendedConfig />
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
              disconnect.mutate('telegram', {
                onSuccess: () => toast.success('Telegram disconnected'),
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
            onClick={() =>
              connect.mutate('telegram', {
                onSuccess: () => toast.success('Telegram connected!'),
                onError: (e) => toast.error(e.message),
              })
            }
            disabled={connect.isPending}
          >
            {connect.isPending ? 'Connecting...' : 'Connect'}
          </Button>
        )}
      </div>
    </div>
  )
}
