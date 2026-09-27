/** `n` kept within [min, max] (min wins when the range is empty). */
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max))
