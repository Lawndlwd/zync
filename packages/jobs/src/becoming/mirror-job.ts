import { codeOf, conflict } from '../errors.js'
import { type Job, validateJob, writeJob } from '../job-file.js'
import { MIRROR_DIR } from './types.js'

/** The scheduled job that writes each week's Mirror; an ordinary job, edited and paused on the Jobs page. */
export const MIRROR_JOB = 'mirror-weekly'

export function mirrorJob(workspace: string, schedule = '0 20 * * 0'): Job {
  return validateJob({
    name: MIRROR_JOB,
    schedule,
    notify: 'always',
    instructions: [
      `Write this week's Mirror for the workspace "${workspace}", following the becoming skill ("The Mirror").`,
      `Read the numbers with becoming_week, then save it with write_mirror (it becomes ${MIRROR_DIR}/<week>.md).`,
      'Your final reply is the push notification: one plain line on the gap between who the user says they',
      'are and what the week shows, then "Three questions are waiting in the Mirror."',
      '',
      'If the becoming skill or the write_mirror tool is not available, stop at once and reply',
      '"zync tools not loaded: restart the AI server". Never look for them outside the workspace.',
    ].join('\n'),
  })
}

/** Create the mirror job in a workspace; 409 when it already exists (it is then edited on the Jobs page). */
export async function enableMirrorJob(wsPath: string, workspace: string, schedule?: string): Promise<Job> {
  const job = mirrorJob(workspace, schedule)
  try {
    await writeJob(wsPath, job)
  } catch (err) {
    if (codeOf(err) === 'EEXIST' || (err instanceof Error && err.message.includes('already exists')))
      throw conflict('The weekly Mirror is already set up: change it on the Jobs page')
    throw err
  }
  return job
}
