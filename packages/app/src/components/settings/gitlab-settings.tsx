import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/store/settings'
import { fetchServerSettings } from '@/services/settings'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MemberPicker } from '@/components/gitlab/member-picker'
import { Save, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { SettingField } from './setting-field'

export function GitLabSettingsContent({ envConfig }: { envConfig: Awaited<ReturnType<typeof fetchServerSettings>> | null }) {
  const { settings, updateGitlab } = useSettingsStore()
  const [baseUrl, setBaseUrl] = useState(settings.gitlab.baseUrl)
  const [pat, setPat] = useState(settings.gitlab.pat)
  const [testResult, setTestResult] = useState<{ ok: boolean; name?: string; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (envConfig?.gitlab?.baseUrl && !baseUrl) setBaseUrl(envConfig.gitlab.baseUrl)
    if (envConfig?.gitlab?.pat && !pat) setPat(envConfig.gitlab.pat)
  }, [envConfig]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="space-y-4">
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
    </div>
  )
}
