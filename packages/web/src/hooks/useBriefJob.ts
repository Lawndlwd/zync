import { useQuery } from '@tanstack/react-query'

import { api } from '../api'
import { BRIEF_JOB } from '../helpers/briefs'

/** The daily-brief job of a workspace (undefined while loading, null when it isn't set up). */
export function useBriefJob(ws: string) {
  const jobs = useQuery({ queryKey: ['jobs', ws], queryFn: () => api.jobs(ws), enabled: !!ws })
  return jobs.data ? (jobs.data.find((j) => j.name === BRIEF_JOB) ?? null) : undefined
}
