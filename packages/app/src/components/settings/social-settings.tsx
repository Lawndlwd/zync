import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettingsStore } from '@/store/settings'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SettingField } from './setting-field'
import { Save, ExternalLink, Instagram, Twitter, Youtube, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import type { SocialPlatform } from '@zync/shared/types'

const platforms: Array<{ key: SocialPlatform; label: string; icon: typeof Instagram; gradient: string }> = [
  { key: 'instagram', label: 'Instagram', icon: Instagram, gradient: 'from-pink-500 to-purple-600' },
  { key: 'x', label: 'X (Twitter)', icon: Twitter, gradient: 'from-sky-400 to-blue-600' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, gradient: 'from-red-500 to-red-700' },
  { key: 'telegram', label: 'Telegram', icon: Send, gradient: 'from-blue-400 to-blue-600' },
]

const featureToggles: Array<{ key: keyof typeof import('@zync/shared/types').defaultSettings.social.features; label: string; description: string }> = [
  { key: 'contentComposer', label: 'Content Composer', description: 'Create, draft, and schedule posts with AI-powered media analysis' },
  { key: 'unifiedInbox', label: 'Unified Inbox', description: 'View and reply to comments across platforms in one place' },
  { key: 'analytics', label: 'Analytics Dashboard', description: 'Track engagement, growth, and posting performance' },
  { key: 'contentCalendar', label: 'Content Calendar', description: 'Visual calendar view of scheduled and published posts' },
  { key: 'autoReply', label: 'Auto-Reply', description: 'Automatically reply to comments using AI (requires inbox)' },
  { key: 'aiSuggestions', label: 'AI Suggestions', description: 'Get AI-powered caption ideas, hashtags, and optimal posting times' },
]

export function SocialSettingsCard() {
  const { settings, updateSocial } = useSettingsStore()
  const [saving, setSaving] = useState(false)

  const saveGlobalSettings = async () => {
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Save failed')
      }
      toast.success('Social media config saved')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleFeature = (key: string, value: boolean) => {
    updateSocial({
      features: { ...settings.social.features, [key]: value },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Media</CardTitle>
        <CardDescription>
          Configure platforms, features, and sync settings for your social media dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Per-platform toggles */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">Platforms</h3>
          {platforms.map(({ key, label, icon: Icon, gradient }) => {
            const platSettings = settings.social[key]
            return (
              <div key={key} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${gradient}`}>
                    <Icon size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{label}</p>
                    <p className="text-xs text-zinc-500">
                      {platSettings.enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    to={`/social/${key}/settings`}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                  >
                    Configure
                    <ExternalLink size={10} />
                  </Link>
                  <button
                    onClick={() => updateSocial({ [key]: { ...platSettings, enabled: !platSettings.enabled } })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      platSettings.enabled ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      platSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Feature toggles */}
        <div className="border-t border-white/[0.06] pt-4 space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">Features</h3>
          <p className="text-xs text-zinc-500 mb-2">Enable or disable individual features. Disabled features won't appear in the dashboard.</p>
          {featureToggles.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-sm font-medium text-zinc-200">{label}</p>
                <p className="text-xs text-zinc-500">{description}</p>
              </div>
              <button
                onClick={() => toggleFeature(key, !settings.social.features[key])}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                  settings.social.features[key] ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  settings.social.features[key] ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          ))}
        </div>

        {/* Global Sync & Auto-reply */}
        <div className="border-t border-white/[0.06] pt-4 space-y-4">
          <h3 className="text-sm font-medium text-zinc-300">Sync & Auto-Reply</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingField
              label="Sync Interval (minutes)"
              value={String(settings.social.syncIntervalMinutes)}
              onChange={(v) => updateSocial({ syncIntervalMinutes: Number(v) || 30 })}
              placeholder="30"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="autoReply"
                checked={settings.social.autoReplyEnabled}
                onChange={(e) => updateSocial({ autoReplyEnabled: e.target.checked })}
                className="rounded border-zinc-600 bg-zinc-800 text-indigo-500"
              />
              <label htmlFor="autoReply" className="text-sm text-zinc-300 font-medium">
                Enable auto-reply to comments
              </label>
            </div>

            {settings.social.autoReplyEnabled && (
              <div className="space-y-3 pl-5 border-l-2 border-indigo-500/20">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requireApproval"
                    checked={settings.social.autoReplyRequireApproval}
                    onChange={(e) => updateSocial({ autoReplyRequireApproval: e.target.checked })}
                    className="rounded border-zinc-600 bg-zinc-800 text-indigo-500"
                  />
                  <label htmlFor="requireApproval" className="text-sm text-zinc-400">
                    Require my approval before sending (drafts replies for review)
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Reply Prompt</label>
                  <textarea
                    value={settings.social.autoReplyPrompt}
                    onChange={(e) => updateSocial({ autoReplyPrompt: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/30 focus:outline-none"
                    placeholder="Instructions for how the AI should reply to comments..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <Button size="sm" onClick={saveGlobalSettings} disabled={saving}>
          <Save size={14} className="mr-1.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  )
}
