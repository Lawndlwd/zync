import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface VoiceSettingsState {
  ttsEnabled: boolean
  ttsVoice: string
  wakeWordEnabled: boolean
  toggleTTS: () => void
  setTTSVoice: (voice: string) => void
  toggleWakeWord: () => void
}

export const useVoiceSettings = create<VoiceSettingsState>()(
  persist(
    (set) => ({
      ttsEnabled: false,
      ttsVoice: 'af_heart',
      wakeWordEnabled: false,
      toggleTTS: () => set((s) => ({ ttsEnabled: !s.ttsEnabled })),
      setTTSVoice: (voice: string) => set({ ttsVoice: voice }),
      toggleWakeWord: () => set((s) => ({ wakeWordEnabled: !s.wakeWordEnabled })),
    }),
    { name: 'zync-voice-settings' },
  ),
)
