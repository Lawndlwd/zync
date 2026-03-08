import { create } from 'zustand'
import type { SocialPlatform } from '../types/social'

interface SocialFilterState {
  platform: SocialPlatform | null
  accountIds: number[]
  setPlatform: (platform: SocialPlatform | null) => void
  setAccountIds: (ids: number[]) => void
  reset: () => void
}

export const useSocialFilter = create<SocialFilterState>((set) => ({
  platform: null,
  accountIds: [],
  setPlatform: (platform) => set({ platform, accountIds: [] }),
  setAccountIds: (accountIds) => set({ accountIds }),
  reset: () => set({ platform: null, accountIds: [] }),
}))
