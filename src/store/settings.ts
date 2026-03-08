import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings } from '@/types/settings'
import { defaultSettings } from '@/types/settings'

interface SettingsStore {
  settings: AppSettings
  updateSettings: (partial: Partial<AppSettings>) => void
  updateJira: (jira: Partial<AppSettings['jira']>) => void
  updateGitlab: (gitlab: Partial<AppSettings['gitlab']>) => void
  updateGithub: (github: Partial<AppSettings['github']>) => void
  updateMessages: (messages: Partial<AppSettings['messages']>) => void
  updateLinear: (linear: Partial<AppSettings['linear']>) => void
  updateSocial: (social: Partial<AppSettings['social']>) => void
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
      updateGithub: (github) =>
        set((state) => ({
          settings: { ...state.settings, github: { ...state.settings.github, ...github } },
        })),
      updateMessages: (messages) =>
        set((state) => ({
          settings: { ...state.settings, messages: { ...state.settings.messages, ...messages } },
        })),
      updateLinear: (linear) =>
        set((state) => ({
          settings: { ...state.settings, linear: { ...state.settings.linear, ...linear } },
        })),
      updateSocial: (social) =>
        set((state) => ({
          settings: { ...state.settings, social: { ...state.settings.social, ...social } },
        })),
      resetSettings: () => set({ settings: defaultSettings }),
    }),
    {
      name: 'zync-settings',
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
            github: { ...defaultSettings.github, ...p?.settings?.github },
            messages: { ...defaultSettings.messages, ...p?.settings?.messages },
            linear: { ...defaultSettings.linear, ...p?.settings?.linear },
            social: { ...defaultSettings.social, ...p?.settings?.social },
          },
        }
      },
    }
  )
)
