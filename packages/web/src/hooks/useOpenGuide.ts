import { useNavigate } from 'react-router'

import { wsUrl } from '../helpers/urls'
import type { GuideState } from '../types/onboarding'
import { GUIDE_PREF } from './useOnboarding'
import { usePref } from './usePref'

/** Bring the "Get started" checklist back on the Overview, even after it was closed. */
export function useOpenGuide(ws: string): () => void {
  const navigate = useNavigate()
  const [, setState] = usePref<GuideState>(GUIDE_PREF, 'open')
  return () => {
    setState('open')
    void navigate(wsUrl(ws, 'overview'))
  }
}
