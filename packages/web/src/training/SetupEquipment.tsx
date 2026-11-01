import { Field } from '../components/Field'
import { PillToggle } from '../components/PillToggle'
import { TextArea } from '../components/TextArea'
import { EQUIPMENT, EQUIPMENT_LABEL, type ProfileDraft } from '../helpers/training'

/** Setup, step 3: the equipment you have (at least one) and injuries to work around. */
export function SetupEquipment({ d, set }: { d: ProfileDraft; set: (patch: Partial<ProfileDraft>) => void }) {
  return (
    <div className="col g16">
      <div className="col g8">
        <span className="flabel">Equipment you have</span>
        <div className="row g6 wrap" role="group" aria-label="Equipment">
          {EQUIPMENT.map((e) => (
            <PillToggle
              key={e}
              pressed={d.equipment.includes(e)}
              onChange={(on) => set({ equipment: on ? [...d.equipment, e] : d.equipment.filter((x) => x !== e) })}
            >
              {EQUIPMENT_LABEL[e]}
            </PillToggle>
          ))}
        </div>
      </div>
      <Field label="Injuries or limits · optional" help="The AI avoids moves that load them.">
        <TextArea
          autoGrow={200}
          rows={3}
          value={d.injuries}
          placeholder="Left shoulder, no overhead pressing"
          onChange={(e) => set({ injuries: e.target.value })}
        />
      </Field>
    </div>
  )
}
