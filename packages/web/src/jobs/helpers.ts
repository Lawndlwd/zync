import { dayLabel, hhmm } from '../helpers/dates'
import type { JobRow } from '../types/jobs'

const DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']

/** "Mondays 15:14", "Every day 08:00", "Once · Fri 02 Oct 09:00"; falls back to the cron text. */
export function describeSchedule(job: NonNullable<JobRow['job']>): string {
  if (job.at) {
    const d = new Date(job.at)
    return Number.isNaN(d.getTime()) ? `Once · ${job.at}` : `Once · ${dayLabel(d)} ${hhmm(d)}`
  }
  const parts = job.schedule?.trim().split(/\s+/) ?? []
  if (parts.length !== 5) return job.schedule ?? '—'
  const [m = '', h = '', dom, mon, dow = ''] = parts
  if (!/^\d+$/.test(m) || !/^\d+$/.test(h) || dom !== '*' || mon !== '*') return `cron ${job.schedule}`
  const t = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
  if (dow === '*') return `Every day ${t}`
  if (dow === '1-5') return `Weekdays ${t}`
  if (/^[0-6]$/.test(dow)) return `${DAYS[Number(dow)]} ${t}`
  return `cron ${job.schedule}`
}
