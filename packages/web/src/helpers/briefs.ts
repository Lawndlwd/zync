import { basename, dirname } from './paths'
import { boardUrl } from './urls'

/** The scheduled job that writes each day's brief (packages/jobs briefs/brief-job.ts). */
export const BRIEF_JOB = 'daily-brief'

/** A card file ("Work/Sprint/Reply.md") opened on its board. */
export const cardUrl = (ws: string, card: string) =>
  `${boardUrl(ws, dirname(card))}?card=${encodeURIComponent(basename(card))}`

/** The file of a day's brief, inside the workspace. */
export const briefFile = (date: string) => `Briefs/${date}.md`
