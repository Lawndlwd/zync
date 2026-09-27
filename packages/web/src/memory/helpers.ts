import type { MemoryScope, MemoryType } from '../types/memory'

export const TYPE_INFO: Record<MemoryType, { label: string; hint: string }> = {
  rule: { label: 'Rule', hint: 'An instruction to follow' },
  preference: { label: 'Preference', hint: 'What you like' },
  habit: { label: 'Habit', hint: 'How you usually work' },
  fact: { label: 'Fact', hint: 'Context worth knowing' },
}

export const scopeName = (scope: MemoryScope, ws: string) => (scope === 'global' ? 'Everywhere' : `Only in ${ws}`)
