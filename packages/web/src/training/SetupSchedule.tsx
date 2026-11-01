import { PillToggle } from '../components/PillToggle'
import { DAYS_PER_WEEK, minutesLabel, type ProfileDraft, SESSION_MINUTES } from '../helpers/training'

/** Setup, step 4: days a week (required) and how long a session can be. */
export function SetupSchedule({ d, set }: { d: ProfileDraft; set: (patch: Partial<ProfileDraft>) => void }) {
  return (
    <div className="col g16">
      <div className="col g8">
        <span className="flabel">Days a week</span>
        <div className="row g6 wrap" role="group" aria-label="Days a week">
          {DAYS_PER_WEEK.map((n) => (
            <PillToggle key={n} pressed={d.daysPerWeek === n} onChange={() => set({ daysPerWeek: n })}>
              {n}
            </PillToggle>
          ))}
        </div>
      </div>
      <div className="col g8">
        <span className="flabel">Session length · optional</span>
        <div className="row g6 wrap" role="group" aria-label="Session length">
          {SESSION_MINUTES.map((m) => (
            <PillToggle
              key={m}
              pressed={d.sessionMinutes === m}
              onChange={(on) => set({ sessionMinutes: on ? m : undefined })}
            >
              {minutesLabel(m)}
            </PillToggle>
          ))}
        </div>
      </div>
    </div>
  )
}
