import { icons, type LucideIcon } from 'lucide-react'

interface HabitIconProps {
  name: string
  size?: number
  className?: string
}

export function HabitIcon({ name, size = 18, className }: HabitIconProps) {
  const Icon: LucideIcon = (icons as Record<string, LucideIcon>)[name] || icons.Circle
  return <Icon size={size} className={className} />
}
