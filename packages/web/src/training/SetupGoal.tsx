import { PillToggle } from '../components/PillToggle'
import { EXPERIENCE_LABEL, EXPERIENCES, GOAL_LABEL, GOALS, type ProfileDraft } from '../helpers/training'

/** Setup, step 2: the goal (required) and experience. */
export function SetupGoal({ d, set }: { d: ProfileDraft; set: (patch: Partial<ProfileDraft>) => void }) {
  return (
    <div className="col g16">
      <div className="col g8">
        <span className="flabel">Main goal</span>
        <div className="row g6 wrap" role="group" aria-label="Goal">
          {GOALS.map((g) => (
            <PillToggle key={g} pressed={d.goal === g} onChange={() => set({ goal: g })}>
              {GOAL_LABEL[g]}
            </PillToggle>
          ))}
        </div>
      </div>
      <div className="col g8">
        <span className="flabel">Experience · optional</span>
        <div className="row g6 wrap" role="group" aria-label="Experience">
          {EXPERIENCES.map((x) => (
            <PillToggle key={x} pressed={d.experience === x} onChange={(on) => set({ experience: on ? x : undefined })}>
              {EXPERIENCE_LABEL[x]}
            </PillToggle>
          ))}
        </div>
      </div>
    </div>
  )
}
