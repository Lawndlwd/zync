import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/store/settings'
import { BoardPicker } from '@/components/jira/board-picker'
import { MemberPicker } from '@/components/gitlab/member-picker'
import { fetchServerSettings } from '@/services/jira'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Save, RotateCcw, Download, Trash2, Plus, Search, Brain, Clock, Wrench, Sparkles,
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
} from '@/hooks/useBot'
import { OpenCodeSettings } from '@/components/opencode/OpenCodeSettings'
import { useOpenCodeProviders, useAgentModels, useSaveAgentModels } from '@/hooks/useOpenCode'
import type { AgentModelConfig } from '@/types/settings'

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

  // Sync local state when envConfig loads
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
    // Save first, then test
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

        {/* Username / "Who am I" selector */}
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

        {/* Local repo paths */}
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

// --- Main page ---

export function SettingsPage() {
  const { settings, updateJira, updateMessages, resetSettings } = useSettingsStore()
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
    if (envConfig.messages.customEndpoint) {
      updateMessages({ customEndpoint: envConfig.messages.customEndpoint })
    }
    toast.success('Settings synced from server .env')
  }

  const handleSave = () => {
    toast.success('Settings saved to browser')
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
          <Button size="sm" onClick={handleSave}>
            <Save size={14} />
            Save
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

        {/* OpenCode — connection + model selection */}
        <OpenCodeSettings />

        {/* AI Model Assignments */}
        <AIModelAssignmentsCard />

        {/* Jira */}
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
              label="API Token"
              value={settings.jira.apiToken}
              onChange={(v) => updateJira({ apiToken: v })}
              type="password"
              placeholder="Your Jira API token"
              envValue={envConfig?.jira.apiToken}
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

        {/* GitLab */}
        <GitLabSettingsCard envConfig={envConfig} />

        {/* Messages */}
        <Card>
          <CardHeader>
            <CardTitle>Message Source</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Source</label>
              <select
                value={settings.messages.source}
                onChange={(e) => updateMessages({ source: e.target.value as 'slack' | 'custom' })}
                className="flex h-9 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-zinc-100"
              >
                <option value="slack">Slack Webhook</option>
                <option value="custom">Custom Endpoint</option>
              </select>
            </div>
            {settings.messages.source === 'slack' ? (
              <SettingField
                label="Slack Webhook URL"
                value={settings.messages.webhookUrl}
                onChange={(v) => updateMessages({ webhookUrl: v })}
                placeholder="https://hooks.slack.com/..."
              />
            ) : (
              <SettingField
                label="Custom API Endpoint"
                value={settings.messages.customEndpoint}
                onChange={(v) => updateMessages({ customEndpoint: v })}
                placeholder="https://api.example.com/messages"
                envValue={envConfig?.messages.customEndpoint}
              />
            )}
          </CardContent>
        </Card>

        {/* Agent Memories */}
        <AgentMemoriesCard />

        {/* Agent Schedules */}
        <AgentSchedulesCard />

        {/* Agent Tools */}
        <AgentToolsCard />
      </div>
    </div>
  )
}

// --- AI Model Assignments Card ---

const MODEL_APP_KEYS: { key: keyof AgentModelConfig; label: string; description: string }[] = [
  { key: 'opencode', label: 'OpenCode Chat', description: 'Model used for dashboard chat sessions.' },
  { key: 'prAgent', label: 'PR Agent', description: 'Model used for PR-Agent operations (review, describe, improve, ask).' },
  { key: 'bot', label: 'Telegram Bot', description: 'Model used for the Telegram AI agent.' },
]

function AIModelAssignmentsCard() {
  const { data: providers } = useOpenCodeProviders()
  const { data: agentModels, isLoading } = useAgentModels()
  const saveAgentModels = useSaveAgentModels()

  const modelOptions = (providers ?? []).flatMap((p) =>
    p.models.map((m) => ({
      value: `${p.id}/${m.id}`,
      label: `${p.name || p.id} / ${m.name || m.id}`,
    }))
  )

  const handleChange = (key: keyof AgentModelConfig, value: string) => {
    const updated: AgentModelConfig = { ...agentModels }
    if (value) {
      updated[key] = { model: value }
    } else {
      delete updated[key]
    }
    saveAgentModels.mutate(updated, {
      onSuccess: () => toast.success('Model assignment saved'),
      onError: () => toast.error('Failed to save model assignment'),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles size={16} />
          AI Model Assignments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-zinc-500">
          Choose which model each app uses. Each selection is passed per-request to OpenCode.
        </p>
        {MODEL_APP_KEYS.map(({ key, label, description }) => (
          <div key={key}>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              {label}
            </label>
            <p className="mb-1.5 text-[11px] text-zinc-500">{description}</p>
            <select
              value={agentModels?.[key]?.model ?? ''}
              onChange={(e) => handleChange(key, e.target.value)}
              disabled={isLoading || !providers?.length || saveAgentModels.isPending}
              className="flex h-9 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-zinc-100"
            >
              <option value="">Default model</option>
              {modelOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </CardContent>
    </Card>
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
