import { useEffect, useSyncExternalStore } from 'react'
import { useThemeStore } from '@/store/theme'

const mediaQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function getSystemDark() {
  return mediaQuery?.matches ?? false
}

function subscribeToSystemTheme(cb: () => void) {
  mediaQuery?.addEventListener('change', cb)
  return () => mediaQuery?.removeEventListener('change', cb)
}

function applyTheme(dark: boolean) {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.setAttribute('data-theme', dark ? 'dark' : 'light')
}

export function useThemeEffect() {
  const theme = useThemeStore((s) => s.theme)
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, getSystemDark)

  useEffect(() => {
    const dark = theme === 'dark' || (theme === 'system' && systemDark)
    applyTheme(dark)
  }, [theme, systemDark])
}

export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useThemeStore((s) => s.theme)
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, getSystemDark)
  if (theme === 'system') return systemDark ? 'dark' : 'light'
  return theme
}
