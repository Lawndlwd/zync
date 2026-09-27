import { SWATCHES } from '../helpers/color'

export function SwatchRow({ value, onChange }: { value?: string; onChange: (c: string) => void }) {
  return (
    <div className="row g6" role="radiogroup" aria-label="Color">
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value?.toLowerCase() === c.toLowerCase()}
          aria-label={c}
          className={`av swatch${value?.toLowerCase() === c.toLowerCase() ? ' on' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  )
}
