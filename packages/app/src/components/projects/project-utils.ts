import type { LucideIcon } from 'lucide-react'
import { BookOpen, Code, FolderOpen, Globe, Heart, Rocket, Star, Zap } from 'lucide-react'

const colorMap: Record<string, { bg: string; text: string; hover: string }> = {
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', hover: 'hover:border-indigo-500/30' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', hover: 'hover:border-blue-500/30' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', hover: 'hover:border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', hover: 'hover:border-amber-500/30' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', hover: 'hover:border-rose-500/30' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', hover: 'hover:border-violet-500/30' },
  teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', hover: 'hover:border-teal-500/30' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', hover: 'hover:border-cyan-500/30' },
}

const defaultColor = colorMap.indigo

const iconMap: Record<string, LucideIcon> = {
  folder: FolderOpen,
  rocket: Rocket,
  code: Code,
  globe: Globe,
  book: BookOpen,
  zap: Zap,
  star: Star,
  heart: Heart,
}

export function getProjectColor(color?: string) {
  return colorMap[color ?? ''] ?? defaultColor
}

export function getProjectIcon(icon?: string): LucideIcon {
  return iconMap[icon ?? ''] ?? FolderOpen
}
