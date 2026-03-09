import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/store/settings'
import { fetchServerSettings } from '@/services/settings'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Save, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { SettingField } from './setting-field'

export function GitHubSettingsContent({ envConfig }: { envConfig: Awaited<ReturnType<typeof fetchServerSettings>> | null }) {
  const { settings, updateGithub } = useSettingsStore()
  const [baseUrl, setBaseUrl] = useState(settings.github.baseUrl)
  const [pat, setPat] = useState(settings.github.pat)
  const [testResult, setTestResult] = useState<{ ok: boolean; name?: string; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (envConfig?.github?.baseUrl && !baseUrl) setBaseUrl(envConfig.github.baseUrl)
    if (envConfig?.github?.pat && !pat) setPat(envConfig.github.pat)
  }, [envConfig]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveConfig = async () => {
    if (!pat) {
      toast.error('Personal Access Token is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/github/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, pat }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Save failed')
      }
      updateGithub({ baseUrl })
      toast.success('GitHub config saved')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    if (pat && pat !== '••••••••') {
      await saveConfig()
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/github/user')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `${res.status} ${res.statusText}`)
      }
      const user = await res.json()
      setTestResult({ ok: true, name: user.login || user.name })
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  const localRepoPaths = settings.github.localRepoPaths || {}
  const [newRepoId, setNewRepoId] = useState('')
  const [newRepoPath, setNewRepoPath] = useState('')

  const addRepoPath = () => {
    if (!newRepoId || !newRepoPath) return
    updateGithub({ localRepoPaths: { ...localRepoPaths, [newRepoId]: newRepoPath } })
    setNewRepoId('')
    setNewRepoPath('')
  }

  const removeRepoPath = (id: string) => {
    const updated = { ...localRepoPaths }
    delete updated[id]
    updateGithub({ localRepoPaths: updated })
  }

  return (
    <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingField
            label="Base URL"
            value={baseUrl}
            onChange={setBaseUrl}
            placeholder="https://api.github.com"
            envValue={envConfig?.github?.baseUrl}
          />
          <SettingField
            label="Personal Access Token"
            value={pat}
            onChange={setPat}
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            envValue={envConfig?.github?.pat}
          />
        </div>

        <SettingField
          label="Username"
          value={settings.github.username}
          onChange={(v) => updateGithub({ username: v })}
          placeholder="your-github-username"
        />

        <SettingField
          label="Default Repository"
          value={settings.github.defaultRepo}
          onChange={(v) => updateGithub({ defaultRepo: v })}
          placeholder="owner/repo"
        />

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={saveConfig} disabled={saving || !pat}>
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
            Local Repository Paths
          </label>
          <p className="mb-2 text-xs text-zinc-600">
            Map GitHub repos (owner/repo) to local filesystem paths for git operations.
          </p>
          {Object.entries(localRepoPaths).length > 0 && (
            <div className="mb-2 space-y-1">
              {Object.entries(localRepoPaths).map(([id, path]) => (
                <div key={id} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-indigo-400 w-32 truncate">{id}</span>
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
              placeholder="owner/repo"
              className="w-40"
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
    </div>
  )
}
