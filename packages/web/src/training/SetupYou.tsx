import { Field } from '../components/Field'
import { PillToggle } from '../components/PillToggle'
import { TextInput } from '../components/TextInput'
import type { ProfileDraft } from '../helpers/training'
import type { Units } from '../types/training'

const UNITS: Units[] = ['kg', 'lb']

/** Setup, step 1: units and body stats (all optional). */
export function SetupYou({ d, set }: { d: ProfileDraft; set: (patch: Partial<ProfileDraft>) => void }) {
  return (
    <div className="col g16">
      <div className="col g8">
        <span className="flabel">Units</span>
        <div className="row g6" role="group" aria-label="Units">
          {UNITS.map((u) => (
            <PillToggle key={u} pressed={d.units === u} onChange={() => set({ units: u })}>
              {u}
            </PillToggle>
          ))}
        </div>
      </div>
      <div className="col g8">
        <span className="flabel">Sex · optional</span>
        <div className="row g6" role="group" aria-label="Sex">
          <PillToggle pressed={d.sex === 'male'} onChange={(on) => set({ sex: on ? 'male' : undefined })}>
            Male
          </PillToggle>
          <PillToggle pressed={d.sex === 'female'} onChange={(on) => set({ sex: on ? 'female' : undefined })}>
            Female
          </PillToggle>
        </div>
      </div>
      <div className="tr-setup-grid">
        <Field label="Birth year · optional">
          <TextInput
            inputMode="numeric"
            value={d.birthYear}
            placeholder="1990"
            onChange={(e) => set({ birthYear: e.target.value })}
          />
        </Field>
        <Field label="Height (cm) · optional">
          <TextInput
            inputMode="decimal"
            value={d.heightCm}
            placeholder="178"
            onChange={(e) => set({ heightCm: e.target.value })}
          />
        </Field>
        <Field label={`Body weight (${d.units}) · optional`} help="Logged as today’s weigh-in.">
          <TextInput
            inputMode="decimal"
            value={d.weight}
            placeholder={d.units === 'kg' ? '78' : '172'}
            onChange={(e) => set({ weight: e.target.value })}
          />
        </Field>
      </div>
    </div>
  )
}
