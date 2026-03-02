import { useState, useCallback, useEffect } from 'react'
import { useSetupStore } from '@/store/setup'
import { verifyIntegration } from '@/services/setup'
import { setSecret } from '@/services/secrets'
import { setConfig } from '@/services/config'
import { useOpenCodeProviders, useAgentModels, useSaveAgentModels } from '@/hooks/useOpenCode'
import type { AgentModelConfig } from '@/types/settings'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Loader2, CheckCircle2, XCircle, ChevronDown,
  Ticket, GitMerge, Send, MessageCircle, Mail, Bell, Cpu,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FieldConfig {
  key: string
  label: string
  placeholder: string
  type?: string
  storage: 'secret' | 'config'
  storageName: string
  category: string
}

interface FormConfig {
  id: string
  name: string
  icon: React.ElementType
  color: string
  fields: FieldConfig[]
  verifyFields?: string[]
  verifiable: boolean
  description?: string
}

const integrationConfigs: FormConfig[] = [
  {
    id: 'jira',
    name: 'Jira',
    icon: Ticket,
    color: 'text-blue-400',
    verifiable: true,
    verifyFields: ['baseUrl', 'apiToken'],
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://your-domain.atlassian.net', storage: 'secret', storageName: 'JIRA_BASE_URL', category: 'jira' },
      { key: 'email', label: 'Email (Cloud only)', placeholder: 'you@company.com', storage: 'secret', storageName: 'JIRA_EMAIL', category: 'jira' },
      { key: 'apiToken', label: 'API Token / PAT', placeholder: 'Your Jira API token or Personal Access Token', type: 'password', storage: 'secret', storageName: 'JIRA_API_TOKEN', category: 'jira' },
      { key: 'projectKey', label: 'Project Key', placeholder: 'PROJ', storage: 'secret', storageName: 'JIRA_PROJECT_KEY', category: 'jira' },
    ],
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    icon: GitMerge,
    color: 'text-violet-400',
    verifiable: true,
    verifyFields: ['baseUrl', 'pat'],
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://gitlab.com', storage: 'secret', storageName: 'GITLAB_BASE_URL', category: 'gitlab' },
      { key: 'pat', label: 'Personal Access Token', placeholder: 'glpat-xxxxxxxxxxxx', type: 'password', storage: 'secret', storageName: 'GITLAB_PAT', category: 'gitlab' },
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: Send,
    color: 'text-sky-400',
    verifiable: true,
    verifyFields: ['botToken'],
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF1234...', type: 'password', storage: 'secret', storageName: 'TELEGRAM_BOT_TOKEN', category: 'telegram' },
      { key: 'allowedUsers', label: 'Allowed User IDs', placeholder: '123456789 (comma-separated)', storage: 'config', storageName: 'TELEGRAM_ALLOWED_USERS', category: 'telegram' },
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: MessageCircle,
    color: 'text-emerald-400',
    verifiable: false,
    description: 'WhatsApp connects via QR code on first message. Configure allowed numbers here.',
    fields: [
      { key: 'allowedNumbers', label: 'Allowed Numbers', placeholder: '+1234567890 (comma-separated, with country code)', storage: 'config', storageName: 'WHATSAPP_ALLOWED_NUMBERS', category: 'whatsapp' },
    ],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: Mail,
    color: 'text-red-400',
    verifiable: false,
    description: 'Gmail uses OAuth. Enter your Google Cloud credentials, then authorize in Settings after setup.',
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'xxxxxx.apps.googleusercontent.com', storage: 'secret', storageName: 'CHANNEL_GMAIL_CLIENT_ID', category: 'channel' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: 'GOCSPX-...', type: 'password', storage: 'secret', storageName: 'CHANNEL_GMAIL_CLIENT_SECRET', category: 'channel' },
    ],
  },
]

const briefingsConfig: FormConfig = {
  id: 'briefings',
  name: 'Briefings',
  icon: Bell,
  color: 'text-orange-400',
  verifiable: false,
  description: 'Automated morning and evening summaries sent to your chat channel.',
  fields: [
    { key: 'morningCron', label: 'Morning Schedule', placeholder: '0 8 * * 1-5 (8 AM weekdays)', storage: 'config', storageName: 'MORNING_BRIEFING_CRON', category: 'briefings' },
    { key: 'eveningCron', label: 'Evening Schedule', placeholder: '0 18 * * 1-5 (6 PM weekdays)', storage: 'config', storageName: 'EVENING_RECAP_CRON', category: 'briefings' },
    { key: 'chatId', label: 'Chat ID', placeholder: 'Telegram chat ID to send briefings to', storage: 'config', storageName: 'DEFAULT_CHAT_ID', category: 'briefings' },
  ],
}

// --- Default Model Selector (uses OpenCode providers) ---

function DefaultModelForm() {
  const { configuredSettings } = useSetupStore()
  const { data: providers, isLoading } = useOpenCodeProviders()
  const { data: agentModels } = useAgentModels()
  const saveAgentModels = useSaveAgentModels()
  const [saved, setSaved] = useState(false)
  const alreadyConfigured = configuredSettings['default-model']

  const allModels = providers?.flatMap((p) =>
    p.models.map((m) => ({
      value: `${p.id}/${m.id}`,
      label: `${p.name || p.id} / ${m.name || m.id}`,
    }))
  ) ?? []

  // Current default: use bot model as the "default" since it's the most general
  const currentModel = agentModels?.bot?.model || agentModels?.opencode?.model || ''

  const handleChange = (value: string) => {
    const updated: AgentModelConfig = {
      ...agentModels,
      bot: { model: value },
      opencode: { model: value },
      prAgent: { model: value },
    }
    saveAgentModels.mutate(updated, {
      onSuccess: () => setSaved(true),
    })
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
          <Cpu className="h-4 w-4 text-amber-400" />
        </div>
        <h3 className="text-sm font-medium text-zinc-200">Default Model</h3>
        {saved && (
          <div className="ml-auto flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-emerald-400">Saved</span>
          </div>
        )}
        {!saved && alreadyConfigured && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Already configured
          </span>
        )}
      </div>

      <p className="text-xs text-zinc-500 mb-4">
        Select the default LLM used across all AI features (bot, PR agent, OpenCode).
        You can override per-feature later in Settings.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading models from OpenCode...
        </div>
      ) : allModels.length === 0 ? (
        <p className="text-xs text-zinc-500">
          No models found. Make sure OpenCode is running.
        </p>
      ) : (
        <Combobox
          options={allModels}
          value={currentModel}
          onChange={(value) => {
            setSaved(false)
            handleChange(value)
          }}
          disabled={saveAgentModels.isPending}
          placeholder="Select a model..."
          searchPlaceholder="Search models..."
        />
      )}
    </div>
  )
}

// --- Generic Form for integrations and briefings ---

function IntegrationForm({ config }: { config: FormConfig }) {
  const { verificationResults, setVerification, configuredIntegrations, configuredSettings } = useSetupStore()
  const alreadyConfigured = configuredIntegrations[config.id] || configuredSettings[config.id]
  const [collapsed, setCollapsed] = useState(false)
  const [hasInitCollapse, setHasInitCollapse] = useState(false)

  useEffect(() => {
    if (alreadyConfigured && !hasInitCollapse) {
      setCollapsed(true)
      setHasInitCollapse(true)
    }
  }, [alreadyConfigured, hasInitCollapse])
  const [values, setValues] = useState<Record<string, string>>({})
  const [verifying, setVerifying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const verification = verificationResults[config.id]
  const Icon = config.icon

  const canVerify = config.verifiable && config.verifyFields?.every((f) => values[f]?.trim())
  const hasValues = config.fields.some((f) => values[f.key]?.trim())

  const handleVerify = useCallback(async () => {
    setVerifying(true)
    try {
      const result = await verifyIntegration(config.id, values)
      setVerification(config.id, result)
    } catch {
      setVerification(config.id, { ok: false, message: 'Network error' })
    } finally {
      setVerifying(false)
    }
  }, [config.id, values, setVerification])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    try {
      for (const field of config.fields) {
        const val = values[field.key]?.trim()
        if (val) {
          if (field.storage === 'secret') {
            await setSecret(field.storageName, val, field.category)
          } else {
            await setConfig(field.storageName, val, field.category)
          }
        }
      }
      setSaved(true)
      if (config.verifiable && !verification?.ok) {
        await handleVerify()
      }
    } catch {
      setVerification(config.id, { ok: false, message: 'Failed to save credentials' })
    } finally {
      setSaving(false)
    }
  }, [config, values, verification, handleVerify, setVerification])

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-3 p-5 text-left"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>
        <h3 className="text-sm font-medium text-zinc-200">{config.name}</h3>
        {verification && (
          <div className="ml-auto flex items-center gap-1.5">
            {verification.ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400" />
            )}
            <span className={cn('text-xs', verification.ok ? 'text-emerald-400' : 'text-red-400')}>
              {verification.message}
            </span>
          </div>
        )}
        {!verification && saved && (
          <div className="ml-auto flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-emerald-400">Saved</span>
          </div>
        )}
        {!verification && !saved && alreadyConfigured && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Already configured
          </span>
        )}
        <ChevronDown className={cn(
          'h-4 w-4 text-zinc-500 transition-transform shrink-0',
          collapsed ? '-rotate-90' : 'rotate-0'
        )} />
      </button>

      {!collapsed && (
        <div className="px-5 pb-5">
          {config.description && (
            <p className="text-xs text-zinc-500 mb-4">{config.description}</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {config.fields.map((field) => (
              <div key={field.key} className={config.fields.length === 1 ? 'sm:col-span-2' : ''}>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">{field.label}</label>
                <Input
                  type={field.type || 'text'}
                  value={values[field.key] || ''}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [field.key]: e.target.value }))
                    setSaved(false)
                  }}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            {config.verifiable && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerify}
                disabled={!canVerify || verifying}
              >
                {verifying && <Loader2 className="h-3 w-3 animate-spin" />}
                Test Connection
              </Button>
            )}
            <Button
              variant={saved ? 'outline' : 'default'}
              size="sm"
              onClick={handleSave}
              disabled={!hasValues || saving}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : null}
              {saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Main Configure Step ---

export function ConfigureStep() {
  const { selectedIntegrations } = useSetupStore()
  const activeIntegrations = integrationConfigs.filter((c) => selectedIntegrations.includes(c.id))

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Configuration</h2>
        <p className="text-zinc-400 text-sm">
          Secrets are encrypted and stored in your local vault. Other settings are saved to the config database.
        </p>
      </div>

      {activeIntegrations.length > 0 && (
        <div className="space-y-4 mb-6">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Integrations</p>
          {activeIntegrations.map((config) => (
            <IntegrationForm key={config.id} config={config} />
          ))}
        </div>
      )}

      <div className="space-y-4">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">App Settings</p>
        <DefaultModelForm />
        <IntegrationForm config={briefingsConfig} />
      </div>
    </div>
  )
}
