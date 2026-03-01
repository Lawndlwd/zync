import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings } from '@/types/settings'
import { defaultSettings } from '@/types/settings'

interface SettingsStore {
  settings: AppSettings
  updateSettings: (partial: Partial<AppSettings>) => void
  updateJira: (jira: Partial<AppSettings['jira']>) => void
  updateGitlab: (gitlab: Partial<AppSettings['gitlab']>) => void
  updateMessages: (messages: Partial<AppSettings['messages']>) => void
  resetSettings: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (partial) =>
        set((state) => ({ settings: { ...state.settings, ...partial } })),
      updateJira: (jira) =>
        set((state) => ({
          settings: { ...state.settings, jira: { ...state.settings.jira, ...jira } },
        })),
      updateGitlab: (gitlab) =>
        set((state) => ({
          settings: { ...state.settings, gitlab: { ...state.settings.gitlab, ...gitlab } },
        })),
      updateMessages: (messages) =>
        set((state) => ({
          settings: { ...state.settings, messages: { ...state.settings.messages, ...messages } },
        })),
      resetSettings: () => set({ settings: defaultSettings }),
    }),
    {
      name: 'ai-dashboard-settings',
      merge: (persisted, current) => {
        const p = persisted as typeof current
        return {
          ...current,
          ...p,
          settings: {
            ...defaultSettings,
            ...p?.settings,
            jira: { ...defaultSettings.jira, ...p?.settings?.jira },
            gitlab: { ...defaultSettings.gitlab, ...p?.settings?.gitlab },
            messages: { ...defaultSettings.messages, ...p?.settings?.messages },
          },
        }
      },
    }
  )
)
