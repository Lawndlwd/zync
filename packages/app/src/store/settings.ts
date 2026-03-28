import type { AppSettings } from '@zync/shared/types'
import { defaultSettings } from '@zync/shared/types'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsStore {
  settings: AppSettings
  updateSettings: (partial: Partial<AppSettings>) => void
  updateMessages: (messages: Partial<AppSettings['messages']>) => void
  resetSettings: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (partial) => set((state) => ({ settings: { ...state.settings, ...partial } })),
      updateMessages: (messages) =>
        set((state) => ({
          settings: { ...state.settings, messages: { ...state.settings.messages, ...messages } },
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
            messages: { ...defaultSettings.messages, ...p?.settings?.messages },
          },
        }
      },
    },
  ),
)
