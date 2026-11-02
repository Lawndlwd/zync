import { codeOf, conflict } from '../errors.js'
import { type Job, validateJob, writeJob } from '../job-file.js'
import { BRIEFS_DIR } from './types.js'

/** The scheduled job that writes each day's brief; an ordinary job, edited and paused on the Jobs page. */
export const BRIEF_JOB = 'daily-brief'

export function briefJob(workspace: string, schedule = '0 7 * * *'): Job {
  return validateJob({
    name: BRIEF_JOB,
    schedule,
    notify: 'always',
    instructions: [
      `Write today's daily brief for the workspace "${workspace}", following the daily-brief skill.`,
      `Save it with write_brief (it becomes ${BRIEFS_DIR}/<today>.md). Your final reply is the push`,
      'notification: the day in three short lines (meetings, what needs an answer, the top to-do).',
      '',
      'If the daily-brief skill or the write_brief tool is not available, stop at once and reply',
      '"zync tools not loaded: restart the AI server". Never look for them outside the workspace.',
    ].join('\n'),
  })
}

/** Create the daily-brief job in a workspace; 409 when it already exists (it is then edited on the Jobs page). */
export async function enableBriefJob(wsPath: string, workspace: string, schedule?: string): Promise<Job> {
  const job = briefJob(workspace, schedule)
  try {
    await writeJob(wsPath, job)
  } catch (err) {
    if (codeOf(err) === 'EEXIST' || (err instanceof Error && err.message.includes('already exists')))
      throw conflict('The daily brief is already set up: change it on the Jobs page')
    throw err
  }
  return job
}
