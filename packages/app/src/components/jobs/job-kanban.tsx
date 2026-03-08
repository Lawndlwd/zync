import { useMemo } from 'react'
import type { Job, JobStatus } from '@zync/shared/types'
import { JobCard } from './job-card'

interface JobKanbanProps {
  jobs: Job[]
  onSelectJob: (job: Job) => void
  onStatusChange: (id: number, status: JobStatus) => void
}

const columns: { status: JobStatus; label: string; color: string; countColor: string }[] = [
  { status: 'new', label: 'New', color: 'border-zinc-500/50', countColor: 'bg-zinc-500/20 text-zinc-400' },
  { status: 'shortlisted', label: 'Shortlisted', color: 'border-emerald-500/50', countColor: 'bg-emerald-500/20 text-emerald-400' },
  { status: 'applied', label: 'Applied', color: 'border-blue-500/50', countColor: 'bg-blue-500/20 text-blue-400' },
  { status: 'dismissed', label: 'Dismissed', color: 'border-red-500/50', countColor: 'bg-red-500/20 text-red-400' },
]

export function JobKanban({ jobs, onSelectJob, onStatusChange }: JobKanbanProps) {
  const grouped = useMemo(() => {
    const map: Record<JobStatus, Job[]> = { new: [], shortlisted: [], applied: [], dismissed: [] }
    for (const job of jobs) {
      if (map[job.status]) map[job.status].push(job)
    }
    // Sort each column by score descending
    for (const key of Object.keys(map) as JobStatus[]) {
      map[key].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    }
    return map
  }, [jobs])

  return (
    <div className="grid h-full grid-cols-4 gap-4 overflow-hidden">
      {columns.map(col => (
        <div key={col.status} className="flex min-h-0 flex-col">
          <div className={`mb-3 flex items-center justify-between border-b-2 pb-2 ${col.color}`}>
            <h3 className="text-sm font-medium text-zinc-300">{col.label}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${col.countColor}`}>
              {grouped[col.status].length}
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2">
            {grouped[col.status].map(job => (
              <JobCard
                key={job.id}
                job={job}
                onSelect={onSelectJob}
                onStatusChange={onStatusChange}
              />
            ))}
            {grouped[col.status].length === 0 && (
              <p className="py-8 text-center text-xs text-zinc-600">No jobs</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
