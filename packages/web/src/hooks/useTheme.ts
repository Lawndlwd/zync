import { useLayoutEffect } from 'react'

import type { Theme } from '../types/shell'
import { useMediaQuery } from './useMediaQuery'
import { usePref } from './usePref'

/** Applies the theme to <html data-theme>, following the OS when set to "system". */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = usePref<Theme>('zync:theme', 'system')
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const dark = theme === 'dark' || (theme === 'system' && prefersDark)
  // Before paint, so switching never flashes the old theme (index.html sets the first one).
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])
  return [theme, setTheme]
}
