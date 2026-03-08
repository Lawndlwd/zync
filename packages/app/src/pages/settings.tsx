import { useEffect, useRef, useState, useCallback } from 'react'
import { useSettingsStore } from '@/store/settings'
import { fetchServerSettings } from '@/services/settings'
import { Button } from '@/components/ui/button'
import { RotateCcw, Download, Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'

import { useNavigate } from 'react-router-dom'
import { SettingsSidebar, type SettingsSection } from '@/components/settings/settings-sidebar'
import { JiraSettingsCard } from '@/components/settings/jira-settings'
import { GitLabSettingsCard } from '@/components/settings/gitlab-settings'
import { GitHubSettingsCard } from '@/components/settings/github-settings'
import { LinearSettingsCard } from '@/components/settings/linear-settings'
import { ChannelsSettingsCard } from '@/components/settings/channels-settings'
import { MemoriesSettingsCard } from '@/components/settings/memories-settings'
import { SchedulesSettingsCard } from '@/components/settings/schedules-settings'
import { ToolsSettingsCard } from '@/components/settings/tools-settings'
import { ConfigSettingsCard } from '@/components/settings/config-settings'
import { ToolConfigSettingsCard } from '@/components/settings/tool-config-settings'
import { BriefingsSettingsCard } from '@/components/settings/briefings-settings'
import { OpenCodeSettings } from '@/components/opencode/OpenCodeSettings'
import { SocialSettingsCard } from '@/components/settings/social-settings'

// Map sections to their parent groups for group-level navigation
const sectionToGroup: Record<string, SettingsSection> = {
  jira: 'integrations',
  gitlab: 'integrations',
  github: 'integrations',
  linear: 'integrations',
  channels: 'integrations',
  social: 'integrations',
  memories: 'agent',
  schedules: 'agent',
  tools: 'agent',
  skills: 'agent',
  config: 'security',
  'tool-config': 'security',
}

// Group sections define which cards to show
const groupSections: Record<string, SettingsSection[]> = {
  integrations: ['jira', 'gitlab', 'github', 'linear', 'channels', 'social'],
  agent: ['memories', 'schedules', 'tools'],
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
            <>
              <div ref={setRef('jira')}>
                <JiraSettingsCard envConfig={envConfig} />
              </div>
              <div ref={setRef('gitlab')}>
                <GitLabSettingsCard envConfig={envConfig} />
              </div>
              <div ref={setRef('github')}>
                <GitHubSettingsCard envConfig={envConfig} />
              </div>
              <div ref={setRef('linear')}>
                <LinearSettingsCard envConfig={envConfig} />
              </div>
              <div ref={setRef('channels')}>
                <ChannelsSettingsCard />
              </div>
              <div ref={setRef('social')}>
                <SocialSettingsCard />
              </div>
            </>
          )}

          {/* Agent */}
          {activeGroup === 'agent' && (
            <>
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
