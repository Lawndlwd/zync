import { useQuery } from '@tanstack/react-query'

import { api } from '../api'
import { onboardingSteps } from '../helpers/onboarding'
import type { GuideState, Step } from '../types/onboarding'
import type { WorkspaceData } from '../types/workspace'
import { usePref } from './usePref'

/** Pref set once the ⌘K palette has been opened (the one step with no trace in the files). */
export const PALETTE_SEEN_PREF = 'zync:tour:palette'

/** Where the checklist stands: open, folded into the top bar, or closed. */
export const GUIDE_PREF = 'zync:getting-started'

/**
 * The "Get started" checklist for a workspace: its steps (ticked from real data), how many are done,
 * and whether it is open, folded into the top bar, or closed for good.
 */
export function useOnboarding(
  ws: string,
  data: WorkspaceData,
): { steps: Step[]; done: number; complete: boolean; state: GuideState; setState: (s: GuideState) => void } {
  const [state, setState] = usePref<GuideState>(GUIDE_PREF, 'open')
  const [paletteSeen] = usePref<'0' | '1'>(PALETTE_SEEN_PREF, '0')
  const active = state !== 'closed'
  // Same keys as the Memory page, so both share the cache.
  const global = useQuery({
    queryKey: ['memory', 'global'],
    queryFn: () => api.memories('global', ws),
    enabled: active,
  })
  const local = useQuery({
    queryKey: ['memory', 'workspace', ws],
    queryFn: () => api.memories('workspace', ws),
    enabled: active && !!ws,
  })
  const memories = (global.data?.length ?? 0) + (local.data?.length ?? 0)
  const steps = onboardingSteps({ data, memories, paletteSeen: paletteSeen === '1' })
  const done = steps.filter((s) => s.done).length
  return { steps, done, complete: done === steps.length, state, setState }
}
