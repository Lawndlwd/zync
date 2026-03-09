import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/store/settings'
import { fetchServerSettings } from '@/services/settings'
import { BoardPicker } from '@/components/jira/board-picker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { SettingField } from './setting-field'

export function JiraSettingsContent({ envConfig }: { envConfig: Awaited<ReturnType<typeof fetchServerSettings>> | null }) {
  const { settings, updateJira } = useSettingsStore()
  const [baseUrl, setBaseUrl] = useState(settings.jira.baseUrl)
  const [email, setEmail] = useState(settings.jira.email)
  const [apiToken, setApiToken] = useState(settings.jira.apiToken)
  const [projectKey, setProjectKey] = useState(settings.jira.projectKey)
  const [testResult, setTestResult] = useState<{ ok: boolean; name?: string; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (envConfig?.jira?.baseUrl && !baseUrl) setBaseUrl(envConfig.jira.baseUrl)
    if (envConfig?.jira?.email && !email) setEmail(envConfig.jira.email)
    if (envConfig?.jira?.apiToken && !apiToken) setApiToken(envConfig.jira.apiToken)
    if (envConfig?.jira?.projectKey && !projectKey) setProjectKey(envConfig.jira.projectKey)
  }, [envConfig]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveConfig = async () => {
    if (!baseUrl || !apiToken) {
      toast.error('Base URL and API Token are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jira: { baseUrl, email, apiToken, projectKey },
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Save failed')
      }
      updateJira({ baseUrl, email, projectKey })
      toast.success('Jira config saved')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    if (baseUrl && apiToken && apiToken !== '••••••••') {
      await saveConfig()
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/jira/projects')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `${res.status} ${res.statusText}`)
      }
      const projects = await res.json()
      setTestResult({ ok: true, name: `${projects.length} project${projects.length !== 1 ? 's' : ''} found` })
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingField
          label="Base URL"
          value={baseUrl}
          onChange={setBaseUrl}
          placeholder="https://your-domain.atlassian.net"
          envValue={envConfig?.jira.baseUrl}
        />
        <SettingField
          label="Email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          envValue={envConfig?.jira.email}
        />
        <SettingField
          label="API Token"
          value={apiToken}
          onChange={setApiToken}
          type="password"
          placeholder="From id.atlassian.com/manage-profile/security/api-tokens"
          envValue={envConfig?.jira.apiToken}
        />
        <SettingField
          label="Project Key"
          value={projectKey}
          onChange={setProjectKey}
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
        <div>
          <SettingField
            label="Default JQL"
            value={settings.jira.defaultJql}
            onChange={(v) => updateJira({ defaultJql: v })}
            placeholder="assignee = currentUser() ORDER BY updated DESC"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={saveConfig} disabled={saving || !baseUrl || !apiToken}>
          <Save size={14} className="mr-1.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button size="sm" variant="default" onClick={testConnection} disabled={testing}>
          {testing ? 'Testing...' : 'Test Connection'}
        </Button>
        {testResult?.ok && (
          <Badge variant="success">Connected — {testResult.name}</Badge>
        )}
        {testResult && !testResult.ok && (
          <Badge variant="danger">Failed: {testResult.error}</Badge>
        )}
      </div>
    </div>
  )
}
