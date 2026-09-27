/** A small ring that fills as `value` approaches `total` (decorative: pair it with the numbers). */
export function ProgressRing({ value, total, size = 28 }: { value: number; total: number; size?: number }) {
  const r = (size - 4) / 2
  const length = 2 * Math.PI * r
  const filled = total > 0 ? value / total : 0
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} />
      <circle
        className="ring-fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeDasharray={length}
        strokeDashoffset={length * (1 - filled)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}
