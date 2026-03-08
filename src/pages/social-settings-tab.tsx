import { useState, useEffect } from 'react'
import { Save, LogIn, RefreshCw, Check, Instagram, Twitter, Youtube } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingField } from '@/components/settings/setting-field'
import { useSettingsStore } from '@/store/settings'
import type { SocialAccount } from '@/types/social'
import * as socialService from '@/services/social'
import toast from 'react-hot-toast'

const platformIcons: Record<string, { icon: typeof Instagram; className: string }> = {
  instagram: { icon: Instagram, className: 'text-pink-400' },
  x: { icon: Twitter, className: 'text-sky-400' },
  youtube: { icon: Youtube, className: 'text-red-400' },
}

export function SocialSettingsTab() {
  const { settings, updateSocial } = useSettingsStore()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    socialService.getAccounts().then(setAccounts).catch(() => {})
  }, [])

  // Handle OAuth callback query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const igConnected = params.get('ig_connected')
    const igError = params.get('ig_error')
    if (igConnected) {
      updateSocial({ instagram: { ...settings.social.instagram, connected: true, username: igConnected } })
      toast.success(`Instagram connected as @${igConnected}`)
      window.history.replaceState({}, '', window.location.pathname)
      socialService.getAccounts().then(setAccounts).catch(() => {})
    } else if (igError) {
      toast.error(`Instagram: ${igError}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const saveConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/social/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagram: settings.social.instagram,
          x: settings.social.x,
          youtube: { email: settings.social.youtube.channelHandle || settings.social.youtube.email, enabled: settings.social.youtube.enabled },
          autoReplyEnabled: settings.social.autoReplyEnabled,
          autoReplyPrompt: settings.social.autoReplyPrompt,
          autoReplyRequireApproval: settings.social.autoReplyRequireApproval,
        }),
      })
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Save failed') }
      toast.success('Settings saved')
    } catch (err: any) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const loginWithInstagram = () => {
    if (!settings.social.instagram.appId || !settings.social.instagram.appSecret) {
      toast.error('Enter App ID and App Secret first')
      return
    }
    saveConfig().then(() => {
      window.location.href = `/api/social/instagram/auth?origin=${encodeURIComponent(window.location.origin)}`
    })
  }

  const refreshToken = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/social/instagram/refresh-token', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Refresh failed')
      toast.success('Instagram token refreshed')
    } catch (err: any) { toast.error(err.message) }
    finally { setRefreshing(false) }
  }

  const features = settings.social.features

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-lg font-semibold text-zinc-100">Social Settings</h2>

      {/* General Feature Toggles */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <h3 className="text-sm font-medium text-zinc-200 mb-3">Features</h3>
        {[
          { key: 'autoReply' as const, label: 'Auto-Reply', desc: 'Automatically reply to comments' },
          { key: 'aiSuggestions' as const, label: 'AI Suggestions', desc: 'AI-powered content suggestions' },
          { key: 'contentCalendar' as const, label: 'Content Calendar', desc: 'Visual scheduling calendar' },
          { key: 'analytics' as const, label: 'Analytics', desc: 'Engagement analytics and charts' },
          { key: 'unifiedInbox' as const, label: 'Unified Inbox', desc: 'Cross-platform comment inbox' },
          { key: 'contentComposer' as const, label: 'Content Composer', desc: 'Draft and publish posts' },
        ].map((feat) => (
          <div key={feat.key} className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm text-zinc-200">{feat.label}</p>
              <p className="text-xs text-zinc-500">{feat.desc}</p>
            </div>
            <button
              onClick={() => updateSocial({ features: { ...features, [feat.key]: !features[feat.key] } })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${features[feat.key] ? 'bg-emerald-500' : 'bg-zinc-700'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${features[feat.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Sync & Auto-reply */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
        <h3 className="text-sm font-medium text-zinc-200">Sync & Auto-reply</h3>
        <SettingField
          label="Sync Interval (minutes)"
          value={String(settings.social.syncIntervalMinutes)}
          onChange={(v) => updateSocial({ syncIntervalMinutes: Number(v) || 30 })}
          placeholder="30"
        />
        <div className="flex items-center gap-2">
          <input type="checkbox" id="autoReplyGlobal" checked={settings.social.autoReplyEnabled}
            onChange={(e) => updateSocial({ autoReplyEnabled: e.target.checked })}
            className="rounded border-zinc-600 bg-zinc-800 text-indigo-500" />
          <label htmlFor="autoReplyGlobal" className="text-sm text-zinc-300">Enable auto-reply to comments</label>
        </div>
        {settings.social.autoReplyEnabled && (
          <div className="space-y-3 pl-5 border-l-2 border-indigo-500/20">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="requireApproval" checked={settings.social.autoReplyRequireApproval}
                onChange={(e) => updateSocial({ autoReplyRequireApproval: e.target.checked })}
                className="rounded border-zinc-600 bg-zinc-800 text-indigo-500" />
              <label htmlFor="requireApproval" className="text-sm text-zinc-400">Require approval before sending</label>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Reply Prompt</label>
              <textarea value={settings.social.autoReplyPrompt} onChange={(e) => updateSocial({ autoReplyPrompt: e.target.value })}
                rows={3} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/30 focus:outline-none" />
            </div>
          </div>
        )}
      </div>

      {/* Connected Accounts */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-200">Connected Accounts</h3>
        </div>

        {accounts.length === 0 ? (
          <p className="text-sm text-zinc-500">No accounts connected yet.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => {
              const platIcon = platformIcons[account.platform]
              const Icon = platIcon?.icon || Instagram
              return (
                <div key={account.id} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3">
                  <div className="flex items-center gap-3">
                    <Icon size={16} className={platIcon?.className || 'text-zinc-400'} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-200">@{account.username}</p>
                      <p className="text-[10px] text-zinc-500 capitalize">{account.platform} · {account.status}</p>
                    </div>
                    {account.last_synced && (
                      <p className="text-[10px] text-zinc-600">Last synced: {new Date(account.last_synced).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Connect new account -- Instagram OAuth */}
        <div className="pt-3 border-t border-white/[0.06] space-y-3">
          <h4 className="text-xs font-medium text-zinc-400">Connect Instagram</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingField label="Facebook App ID" value={settings.social.instagram.appId}
              onChange={(v) => updateSocial({ instagram: { ...settings.social.instagram, appId: v } })} placeholder="123456789012345" />
            <SettingField label="Facebook App Secret" value={settings.social.instagram.appSecret}
              onChange={(v) => updateSocial({ instagram: { ...settings.social.instagram, appSecret: v } })} type="password" placeholder="From Facebook Developer Console" />
          </div>
          <div className="flex gap-2">
            {!settings.social.instagram.connected ? (
              <Button size="sm" onClick={loginWithInstagram}><LogIn size={14} className="mr-1.5" />Login with Instagram</Button>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-sm text-emerald-400"><Check size={14} />Connected as @{settings.social.instagram.username}</div>
                <Button size="sm" variant="outline" onClick={refreshToken} disabled={refreshing}>
                  <RefreshCw size={14} className={`mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Refreshing...' : 'Refresh Token'}
                </Button>
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => {
                    updateSocial({ instagram: { appId: settings.social.instagram.appId, appSecret: settings.social.instagram.appSecret, accessToken: '', connected: false, username: '', enabled: settings.social.instagram.enabled } })
                    toast.success('Instagram disconnected')
                  }}>
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <Button size="sm" onClick={saveConfig} disabled={saving}>
        <Save size={14} className="mr-1.5" />{saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  )
}
