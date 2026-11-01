import { profilePath } from './paths.js'
import { readRecord, writeRecord } from './record-file.js'
import {
  ProfileFileSchema,
  type TrainingProfile,
  type TrainingProfileInput,
  TrainingProfileInputSchema,
} from './types.js'

/** The training profile; null until the user set it up (or when the page is unreadable). */
export async function readProfile(wsPath: string): Promise<TrainingProfile | null> {
  const page = await readRecord(await profilePath(wsPath))
  if (!page) return null
  const r = ProfileFileSchema.safeParse(page.data)
  return r.success ? { ...r.data, notes: page.body } : null
}

/** Set up or replace the profile; the first setup time is kept. */
export async function saveProfile(wsPath: string, raw: TrainingProfileInput): Promise<TrainingProfile> {
  const { notes, ...input } = TrainingProfileInputSchema.parse(raw)
  const file = await profilePath(wsPath)
  const current = await readProfile(wsPath)
  const setupAt = current?.setupAt ?? new Date().toISOString()
  // No `notes` in the request keeps the page body the user wrote.
  const profile: TrainingProfile = { ...input, setupAt, notes: notes?.trim() ?? current?.notes ?? '' }
  await writeRecord(
    file,
    {
      goal: profile.goal,
      experience: profile.experience,
      equipment: profile.equipment,
      injuries: profile.injuries,
      daysPerWeek: profile.daysPerWeek,
      sessionMinutes: profile.sessionMinutes,
      units: profile.units,
      sex: profile.sex,
      birthYear: profile.birthYear,
      heightCm: profile.heightCm,
      setupAt,
    },
    profile.notes,
  )
  return profile
}
