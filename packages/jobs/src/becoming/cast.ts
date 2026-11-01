import { addDays, localStamp } from '../helpers/dates.js'
import { readActivity } from './activity.js'
import { evidenceFor } from './evidence.js'
import { appendProof, listIdentities, readIdentity, removeProof } from './store.js'
import { zyncBusy } from './today.js'
import type { Busy, Identity, Vote, VoteKind, VoteSource } from './types.js'
import { appendVote, readVotes, standingVotes, voteKey } from './votes.js'
import { workoutsDone } from './workouts.js'

/** The proof line a vote cast by hand leaves on the identity page. */
export const castNote = (identity: Identity, kind: 'full' | 'small') =>
  kind === 'small' ? `small: ${(identity.small ?? identity.action).toLowerCase()}` : identity.action.toLowerCase()

/** Vote for an identity on a day (or clear the vote): recorded, and written into its proof. */
export async function castVote(
  wsPath: string,
  file: string,
  date: string,
  kind: VoteKind,
  source: Exclude<VoteSource, 'auto'>,
  note?: string,
): Promise<Vote> {
  const identity = await readIdentity(wsPath, file)
  const vote = await appendVote(wsPath, { date, identity: file, kind, source, ...(note ? { note } : {}) })
  if (kind === 'clear') await removeProof(wsPath, file, date)
  else await appendProof(wsPath, file, [{ date, text: note ?? castNote(identity, kind), source }])
  return vote
}

const FINALIZE_DAYS = 7

/**
 * Turn what Zync saw into votes, for the days before `today` (a week back, so a scheduler that was
 * down catches up). A day that already has a vote is left alone, so running it twice changes
 * nothing. Returns how many votes were added.
 */
export async function finalizeDays(
  wsPath: string,
  today = localStamp().slice(0, 10),
  external: Busy[] = [],
): Promise<number> {
  const from = addDays(today, -FINALIZE_DAYS)
  const [identities, votes, activity, own, workouts] = await Promise.all([
    listIdentities(wsPath),
    readVotes(wsPath),
    readActivity(wsPath, from, today),
    zyncBusy(wsPath, from, today),
    workoutsDone(wsPath, from, today),
  ])
  const standing = standingVotes(votes)
  const events = [...own, ...external]
  let added = 0
  for (let date = from; date < today; date = addDays(date, 1)) {
    const facts = {
      date,
      activity: activity.filter((a) => a.t.startsWith(date)),
      events,
      now: `${today}T00:00`,
      workouts,
    }
    for (const identity of identities) {
      if (identity.since === '' || date < identity.since || standing.has(voteKey(date, identity.file))) continue
      const seen = evidenceFor(identity, facts)
      if (!seen) continue
      await appendVote(wsPath, { date, identity: identity.file, kind: seen.kind, source: 'auto', note: seen.note })
      await appendProof(wsPath, identity.file, [{ date, text: seen.note, source: 'auto' }])
      added++
    }
  }
  return added
}
