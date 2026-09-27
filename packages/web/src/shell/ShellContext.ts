import { createContext, useContext } from 'react'

import type { Shell } from '../types/shell'

export const ShellContext = createContext<Shell | null>(null)

export function useShell(): Shell {
  const s = useContext(ShellContext)
  if (!s) throw new Error('useShell outside Layout')
  return s
}
