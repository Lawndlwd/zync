import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface VerificationResult {
  ok: boolean
  message?: string
}

interface SetupState {
  currentStep: number
  selectedIntegrations: string[]
  verificationResults: Record<string, VerificationResult>
  configuredIntegrations: Record<string, boolean>
  configuredSettings: Record<string, boolean>
  setStep: (n: number) => void
  toggleIntegration: (id: string) => void
  setVerification: (service: string, result: VerificationResult) => void
  setConfigured: (integrations: Record<string, boolean>, settings: Record<string, boolean>) => void
  preSelectConfigured: (integrations: Record<string, boolean>) => void
  reset: () => void
}

export const useSetupStore = create<SetupState>()(
  persist(
    (set) => ({
      currentStep: 0,
      selectedIntegrations: [],
      verificationResults: {},
      configuredIntegrations: {},
      configuredSettings: {},

      setStep: (n) => set({ currentStep: n }),

      toggleIntegration: (id) =>
        set((state) => ({
          selectedIntegrations: state.selectedIntegrations.includes(id)
            ? state.selectedIntegrations.filter((i) => i !== id)
            : [...state.selectedIntegrations, id],
        })),

      setVerification: (service, result) =>
        set((state) => ({
          verificationResults: { ...state.verificationResults, [service]: result },
        })),

      setConfigured: (integrations, settings) =>
        set({ configuredIntegrations: integrations, configuredSettings: settings }),

      preSelectConfigured: (integrations) =>
        set((state) => {
          const configured = Object.entries(integrations)
            .filter(([, v]) => v)
            .map(([k]) => k)
          const merged = new Set([...state.selectedIntegrations, ...configured])
          return { selectedIntegrations: [...merged] }
        }),

      reset: () =>
        set({
          currentStep: 0,
          selectedIntegrations: [],
          verificationResults: {},
          configuredIntegrations: {},
          configuredSettings: {},
        }),
    }),
    {
      name: 'zync-setup-wizard',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        currentStep: state.currentStep,
        selectedIntegrations: state.selectedIntegrations,
        verificationResults: state.verificationResults,
      }),
    }
  )
)
