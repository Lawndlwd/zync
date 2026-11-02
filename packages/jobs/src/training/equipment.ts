import type { EquipmentTag } from './types.js'

/** Catalog equipment each profile tag gives access to; body weight is always available. */
const CATALOG_EQUIPMENT: Record<EquipmentTag, string[]> = {
  bodyweight: ['Body Weight'],
  bands: ['Band', 'Resistance Band'],
  dumbbells: ['Dumbbell'],
  kettlebells: ['Kettlebell'],
  pull_up_bar: ['Body Weight'],
  barbell: ['Barbell', 'Olympic Barbell', 'Ez Barbell', 'Trap Bar', 'Weighted'],
  machines: ['Leverage Machine', 'Smith Machine', 'Cable', 'Assisted', 'Sled Machine'],
  gym: [],
}

/** The catalog equipment the user owns; null means everything (a full gym). */
export function ownedEquipment(tags: readonly EquipmentTag[]): Set<string> | null {
  if (tags.includes('gym')) return null
  return new Set(['Body Weight', ...tags.flatMap((t) => CATALOG_EQUIPMENT[t])])
}
