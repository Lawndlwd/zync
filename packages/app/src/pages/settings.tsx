import { useEffect, useRef, useState, useCallback } from 'react'
import { useSettingsStore } from '@/store/settings'
import { fetchServerSettings } from '@/services/settings'
import { Button } from '@/components/ui/button'
import { RotateCcw, Download, Wand2 } from 'lucide-react'
import {
  Ticket, GitMerge, Github, BarChart3,
  Send, MessageCircle, Mail, Instagram,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useNavigate } from 'react-router-dom'
import { SettingsSidebar, type SettingsSection } from '@/components/settings/settings-sidebar'
import { IntegrationCard } from '@/components/settings/integration-card'
import { JiraSettingsContent } from '@/components/settings/jira-settings'
import { GitLabSettingsContent } from '@/components/settings/gitlab-settings'
import { GitHubSettingsContent } from '@/components/settings/github-settings'
import { LinearSettingsContent } from '@/components/settings/linear-settings'
import { TelegramConfig, WhatsAppConfig, GmailConfig } from '@/components/settings/channels-settings'
import { SocialSettingsContent } from '@/components/settings/social-settings'
import { MemoriesSettingsCard } from '@/components/settings/memories-settings'
import { SchedulesSettingsCard } from '@/components/settings/schedules-settings'
import { ToolsSettingsCard } from '@/components/settings/tools-settings'
import { MemoryProfileTab } from '@/components/settings/memory-profile'
import { MemoryInstructionsTab } from '@/components/settings/memory-instructions'
import { ConfigSettingsCard } from '@/components/settings/config-settings'
import { ToolConfigSettingsCard } from '@/components/settings/tool-config-settings'
import { BriefingsSettingsCard } from '@/components/settings/briefings-settings'
import { OpenCodeSettings } from '@/components/opencode/OpenCodeSettings'
import { useBotChannels } from '@/hooks/useBot'

// Map sections to their parent groups for group-level navigation
const sectionToGroup: Record<string, SettingsSection> = {
  profile: 'agent',
  instructions: 'agent',
  memories: 'agent',
  schedules: 'agent',
  tools: 'agent',
  skills: 'agent',
  config: 'security',
  'tool-config': 'security',
}

// Group sections define which cards to show
const groupSections: Record<string, SettingsSection[]> = {
  integrations: ['integrations'],
  agent: ['profile', 'instructions', 'memories', 'schedules', 'tools'],
  security: ['config', 'tool-config'],
  briefings: ['briefings'],
  opencode: ['opencode'],
}

function getInitialSection(): SettingsSection {
  const hash = window.location.hash.slice(1) as SettingsSection
  if (hash && (groupSections[hash] || sectionToGroup[hash] || hash === 'briefings' || hash === 'opencode')) {
    return hash
  }
  return 'integrations'
}

function IntegrationsSection({ envConfig }: { envConfig: Awaited<ReturnType<typeof fetchServerSettings>> | null }) {
  const { settings } = useSettingsStore()
  const { data: channels } = useBotChannels()

  const getChannelStatus = (name: string): 'connected' | 'configured' | 'off' => {
    const ch = channels?.find(c => c.channel === name)
    if (!ch) return 'off'
    if (ch.connected) return 'connected'
    if (ch.configured) return 'configured'
    return 'off'
  }

  const getChannelData = (name: string) => channels?.find(c => c.channel === name)

  const hasToken = (val?: string) => !!val && val !== '' && val !== '••••••••'

  return (
    <div className="space-y-3">
      <IntegrationCard
        id="jira"
        name="Jira"
        icon={<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700"><Ticket size={16} className="text-white" /></div>}
        status={envConfig?.jira?.baseUrl && hasToken(envConfig?.jira?.apiToken) ? 'connected' : envConfig?.jira?.baseUrl ? 'configured' : 'off'}
      >
        <JiraSettingsContent envConfig={envConfig} />
      </IntegrationCard>

      <IntegrationCard
        id="gitlab"
        name="GitLab"
        icon={<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-600"><GitMerge size={16} className="text-white" /></div>}
        status={envConfig?.gitlab?.baseUrl && hasToken(envConfig?.gitlab?.pat) ? 'connected' : envConfig?.gitlab?.baseUrl ? 'configured' : 'off'}
      >
        <GitLabSettingsContent envConfig={envConfig} />
      </IntegrationCard>

      <IntegrationCard
        id="github"
        name="GitHub"
        icon={<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-600 to-zinc-800"><Github size={16} className="text-white" /></div>}
        status={hasToken(envConfig?.github?.pat) ? 'connected' : envConfig?.github?.baseUrl ? 'configured' : 'off'}
      >
        <GitHubSettingsContent envConfig={envConfig} />
      </IntegrationCard>

      <IntegrationCard
        id="linear"
        name="Linear"
        icon={<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600"><BarChart3 size={16} className="text-white" /></div>}
        status={hasToken(envConfig?.linear?.apiKey) ? 'connected' : 'off'}
      >
        <LinearSettingsContent envConfig={envConfig} />
      </IntegrationCard>

      <IntegrationCard
        id="telegram"
        name="Telegram"
        icon={<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-400 to-blue-600"><Send size={16} className="text-white" /></div>}
        status={getChannelStatus('telegram')}
      >
        <TelegramConfig connected={getChannelData('telegram')?.connected ?? false} />
      </IntegrationCard>

      <IntegrationCard
        id="whatsapp"
        name="WhatsApp"
        icon={<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600"><MessageCircle size={16} className="text-white" /></div>}
        status={getChannelStatus('whatsapp')}
      >
        <WhatsAppConfig
          connected={getChannelData('whatsapp')?.connected ?? false}
          connectionState={getChannelData('whatsapp')?.connectionState ?? ''}
        />
      </IntegrationCard>

      <IntegrationCard
        id="gmail"
        name="Google"
        icon={<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-400 to-red-600"><Mail size={16} className="text-white" /></div>}
        status={getChannelStatus('gmail')}
      >
        <GmailConfig connected={getChannelData('gmail')?.connected ?? false} />
      </IntegrationCard>

      <IntegrationCard
        id="instagram"
        name="Instagram"
        icon={<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-purple-600"><Instagram size={16} className="text-white" /></div>}
        status={settings.social.instagram.enabled ? 'connected' : 'off'}
      >
        <SocialSettingsContent />
      </IntegrationCard>
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { settings, updateJira, resetSettings } = useSettingsStore()
  const [envConfig, setEnvConfig] = useState<Awaited<ReturnType<typeof fetchServerSettings>> | null>(null)
  const [activeSection, setActiveSection] = useState<SettingsSection>(getInitialSection)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

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

  // Determine which group is active (for rendering the right cards)
  const activeGroup = groupSections[activeSection]
    ? activeSection
    : sectionToGroup[activeSection] || activeSection

  const handleNavigate = useCallback((section: SettingsSection) => {
    window.location.hash = section
    setActiveSection(section)

    // If navigating to a child, scroll to it after render
    if (sectionToGroup[section]) {
      requestAnimationFrame(() => {
        sectionRefs.current[section]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [])

  const setRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    sectionRefs.current[id] = el
  }, [])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
          <p className="text-sm text-zinc-500">Configure your integrations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/setup')}>
            <Wand2 size={14} />
            Re-run Setup
          </Button>
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

      <div className="flex gap-6 h-[calc(100vh-7rem)]">
        <SettingsSidebar activeSection={activeSection} onNavigate={handleNavigate} />

        <div className="flex-1 min-w-0 space-y-6 overflow-y-auto pr-1">
          {/* Integrations */}
          {activeGroup === 'integrations' && (
            <IntegrationsSection envConfig={envConfig} />
          )}

          {/* Agent */}
          {activeGroup === 'agent' && (
            <>
              <div ref={setRef('profile')}>
                <MemoryProfileTab />
              </div>
              <div ref={setRef('instructions')}>
                <MemoryInstructionsTab />
              </div>
              <div ref={setRef('memories')}>
                <MemoriesSettingsCard />
              </div>
              <div ref={setRef('schedules')}>
                <SchedulesSettingsCard />
              </div>
              <div ref={setRef('tools')}>
                <ToolsSettingsCard />
              </div>
            </>
          )}

          {/* Security */}
          {activeGroup === 'security' && (
            <>
              <div ref={setRef('config')}>
                <ConfigSettingsCard />
              </div>
              <div ref={setRef('tool-config')}>
                <ToolConfigSettingsCard />
              </div>
            </>
          )}

          {/* Briefings */}
          {activeGroup === 'briefings' && (
            <BriefingsSettingsCard />
          )}

          {/* OpenCode */}
          {activeGroup === 'opencode' && (
            <OpenCodeSettings />
          )}
        </div>
      </div>
    </div>
  )
}
