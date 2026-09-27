import type { CSSProperties } from 'react'

import { clamp } from '../helpers/math'
import { basename } from '../helpers/paths'
import { wsUrl } from '../helpers/urls'
import type { ViewContext } from '../types/shell'

export function viewOf(ws: string, pathname: string): ViewContext | null {
  const rest = pathname.slice(wsUrl(ws).length + 1)
  const [section, ...tail] = rest.split('/')
  const sub = tail.map(decodeURIComponent).join('/')
  switch (section) {
    case 'overview':
      return { kind: 'overview', label: 'Overview' }
    case 'files':
      return sub ? { kind: 'file', label: basename(sub) } : { kind: 'files', label: 'Files' }
    case 'boards':
      return sub ? { kind: 'board', label: basename(sub) } : { kind: 'boards', label: 'Boards' }
    case 'jobs':
      return { kind: 'jobs', label: 'Jobs' }
    case 'calendar':
      return { kind: 'calendar', label: 'Calendar' }
    case 'opencode':
      return { kind: 'opencode', label: sub ? basename(sub) : 'OpenCode' }
    case 'people':
      return { kind: 'people', label: 'People' }
    case 'memory':
      return { kind: 'memory', label: 'Memory' }
    case 'settings':
      return { kind: 'settings', label: 'Settings' }
    case undefined:
    default:
      return null
  }
}

const MIN_PANE_PX = 280

/**
 * Move `deltaPx` of width from side `index + 1` to side `index` (negative = the other way), in a
 * row `widthPx` wide. Neither side goes below MIN_PANE_PX; the other sides don't change.
 */
export function shiftSizes(start: number[], index: number, deltaPx: number, widthPx: number): number[] {
  const total = start.reduce((a, b) => a + b, 0)
  if (!(widthPx > 0) || !total) return start
  const pxPerUnit = widthPx / total
  const here = start[index] ?? 0
  const pair = here + (start[index + 1] ?? 0)
  const min = Math.min(MIN_PANE_PX / pxPerUnit, pair / 2)
  const a = clamp(here + deltaPx / pxPerUnit, min, pair - min)
  const next = [...start]
  next[index] = a
  next[index + 1] = pair - a
  return next
}

/** Drop paths inside another selected folder: acting on the folder covers them. */
export const topLevel = (paths: string[]) => paths.filter((p) => !paths.some((q) => q !== p && p.startsWith(`${q}/`)))

/** The paths being dragged: the whole selection when the dragged item is part of it. */
export const draggedPaths = (dt: DataTransfer): string[] => {
  try {
    const many = JSON.parse(dt.getData('text/zync-paths') || '[]')
    if (Array.isArray(many) && many.length) return many
  } catch {}
  const one = dt.getData('text/zync-path')
  return one ? [one] : []
}

export function depthProps(depth: number): { cls: string; style?: CSSProperties } {
  if (depth === 0) return { cls: '' }
  if (depth <= 2) return { cls: ` d${depth}` }
  return { cls: '', style: { paddingLeft: 22 + 18 * (depth - 1) } }
}

/** Drag handle between Main and the split dock (30–60% of the app width). */
export const clampDockPct = (p: number) => clamp(p, 0.3, 0.6)
