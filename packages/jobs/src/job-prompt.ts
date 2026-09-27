import type { Job } from './job-file.js'

/** The prompt a scheduled job's unattended session starts with. */
export function buildPrompt(job: Job, wsPath?: string): string {
  const lines = [
    `You are running the scheduled job "${job.name}" unattended. No human is watching this session,`,
    'so do not ask questions: make reasonable decisions and complete the task.',
    '',
  ]
  if (wsPath) {
    // Models sometimes guess a project root from elsewhere (e.g. an enclosing git repo) and write there.
    lines.push(
      `Your workspace is ${wsPath}. Relative paths and "the workspace root" mean this directory.`,
      'Read and write files only inside it, including from shell commands.',
      '',
    )
  }
  if (job.context.length) {
    lines.push('Before starting, read these files/folders for context:')
    for (const c of job.context) lines.push(`- ${c}`)
    lines.push('')
  }
  lines.push('## Task', job.instructions, '')
  lines.push('When finished, reply with a short summary of what you did and where the results are.')
  return lines.join('\n')
}
