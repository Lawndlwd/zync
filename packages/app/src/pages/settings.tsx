import { Mail, MessageCircle, RotateCcw, Send, Wand2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OpenCodeSettings } from '@/components/opencode/OpenCodeSettings'
import { BriefingsSettingsCard } from '@/components/settings/briefings-settings'
import { ConfigSettingsCard } from '@/components/settings/config-settings'
import { GmailConfig } from '@/components/settings/gmail-config'
import { IntegrationCard } from '@/components/settings/integration-card'
import { MemoriesSettingsCard } from '@/components/settings/memories-settings'
import { MemoryInstructionsTab } from '@/components/settings/memory-instructions'
import { MemoryProfileTab } from '@/components/settings/memory-profile'
import { SchedulesSettingsCard } from '@/components/settings/schedules-settings'
import { type SettingsSection, SettingsSidebar } from '@/components/settings/settings-sidebar'
import { TelegramConfig } from '@/components/settings/telegram-config'
import { ToolConfigSettingsCard } from '@/components/settings/tool-config-settings'
import { ToolsSettingsCard } from '@/components/settings/tools-settings'
import { WhatsAppConfig } from '@/components/settings/whatsapp-config'
import { Button } from '@/components/ui/button'
import { useBotChannels } from '@/hooks/useBot'
import { useSettingsStore } from '@/store/settings'

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

function IntegrationsSection() {
  const { data: channels } = useBotChannels()

  const getChannelStatus = (name: string): 'connected' | 'configured' | 'off' => {
    const ch = channels?.find((c) => c.channel === name)
    if (!ch) return 'off'
    if (ch.connected) return 'connected'
    if (ch.configured) return 'configured'
    return 'off'
  }

  const getChannelData = (name: string) => channels?.find((c) => c.channel === name)

  return (
    <div className="space-y-3">
      <IntegrationCard
        id="telegram"
        name="Telegram"
        icon={
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-400 to-blue-600">
            <Send size={16} className="text-white" />
          </div>
        }
        status={getChannelStatus('telegram')}
      >
        <TelegramConfig connected={getChannelData('telegram')?.connected ?? false} />
      </IntegrationCard>

      <IntegrationCard
        id="whatsapp"
        name="WhatsApp"
        icon={
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600">
            <MessageCircle size={16} className="text-white" />
          </div>
        }
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
        icon={
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-400 to-red-600">
            <Mail size={16} className="text-white" />
          </div>
        }
        status={getChannelStatus('gmail')}
      >
        <GmailConfig connected={getChannelData('gmail')?.connected ?? false} />
      </IntegrationCard>
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { resetSettings } = useSettingsStore()
  const [activeSection, setActiveSection] = useState<SettingsSection>(getInitialSection)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Determine which group is active (for rendering the right cards)
  const activeGroup = groupSections[activeSection] ? activeSection : sectionToGroup[activeSection] || activeSection

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

  const setRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      sectionRefs.current[id] = el
    },
    [],
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure your integrations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/setup')}>
            <Wand2 size={14} />
            Re-run Setup
          </Button>
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
          {activeGroup === 'integrations' && <IntegrationsSection />}

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
          {activeGroup === 'briefings' && <BriefingsSettingsCard />}

          {/* OpenCode */}
          {activeGroup === 'opencode' && <OpenCodeSettings />}
        </div>
      </div>
    </div>
  )
}
