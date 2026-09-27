/** Readable text on a person's colour: dark ink on light swatches, light on dark ones. */
export function textOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1b1b16' : '#F4F7EC'
}

/** Soft swatches from the handoff (People → color). */
export const SWATCHES = ['#E8C9A8', '#B9CFD9', '#D8C6E0', '#C9DDB8', '#EBD9A0', '#F0C4BA', '#C4CBB4', '#A9C7C0']
