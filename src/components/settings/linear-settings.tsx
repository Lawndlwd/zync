import { useState } from 'react'
import { useSettingsStore } from '@/store/settings'
import { fetchServerSettings } from '@/services/settings'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { SettingField } from './setting-field'

export function LinearSettingsCard({ envConfig }: { envConfig: Awaited<ReturnType<typeof fetchServerSettings>> | null }) {
  const { settings, updateLinear } = useSettingsStore()
  const [apiKey, setApiKey] = useState(settings.linear.apiKey)
  const [testResult, setTestResult] = useState<{ ok: boolean; name?: string; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  const saveConfig = async () => {
    if (!apiKey) {
      toast.error('API Key is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/linear/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Save failed')
      }
      updateLinear({ apiKey })
      toast.success('Linear config saved')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    if (apiKey && apiKey !== '••••••••') {
      await saveConfig()
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/linear/me')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `${res.status} ${res.statusText}`)
      }
      const user = await res.json()
      setTestResult({ ok: true, name: user.name || user.displayName })
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linear Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingField
            label="API Key"
            value={apiKey}
            onChange={setApiKey}
            type="password"
            placeholder="lin_api_xxxxxxxxxxxxxxxxxxxx"
            envValue={envConfig?.linear?.apiKey}
          />
          <SettingField
            label="Default Team ID"
            value={settings.linear.defaultTeamId}
            onChange={(v) => updateLinear({ defaultTeamId: v })}
            placeholder="team-uuid"
            envValue={envConfig?.linear?.defaultTeamId}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={saveConfig} disabled={saving || !apiKey}>
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
      </CardContent>
    </Card>
  )
}
