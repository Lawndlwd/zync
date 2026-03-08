import { cn } from '@/lib/utils'
import type { Job } from '@/types/jobs'
import { MapPin, Building2, ExternalLink, ThumbsUp, ThumbsDown, Send } from 'lucide-react'

interface JobCardProps {
  job: Job
  onSelect: (job: Job) => void
  onStatusChange: (id: number, status: 'shortlisted' | 'dismissed' | 'applied') => void
}

const sourceColors: Record<string, string> = {
  indeed: 'bg-indigo-500/20 text-indigo-400',
  linkedin: 'bg-blue-500/20 text-blue-400',
  wttj: 'bg-amber-500/20 text-amber-400',
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null
  const color =
    score >= 8 ? 'bg-emerald-500/20 text-emerald-400' :
    score >= 5 ? 'bg-amber-500/20 text-amber-400' :
    'bg-red-500/20 text-red-400'
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', color)}>
      {score}/10
    </span>
  )
}

export function JobCard({ job, onSelect, onStatusChange }: JobCardProps) {
  return (
    <div
      onClick={() => onSelect(job)}
      className="cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06]"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-zinc-100 line-clamp-2">{job.title}</h4>
        <ScoreBadge score={job.score} />
      </div>

      <div className="mb-2 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Building2 size={12} className="shrink-0" />
          <span className="truncate">{job.company}</span>
        </div>
        {job.location && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{job.location}</span>
          </div>
        )}
        {job.salary && (
          <p className="text-xs text-emerald-400/80">{job.salary}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium uppercase', sourceColors[job.source] || 'bg-zinc-700 text-zinc-400')}>
          {job.source}
        </span>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {job.status === 'new' && (
            <>
              <button
                onClick={() => onStatusChange(job.id, 'shortlisted')}
                className="rounded p-1 text-zinc-500 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400"
                title="Shortlist"
              >
                <ThumbsUp size={14} />
              </button>
              <button
                onClick={() => onStatusChange(job.id, 'dismissed')}
                className="rounded p-1 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                title="Dismiss"
              >
                <ThumbsDown size={14} />
              </button>
            </>
          )}
          {job.status === 'shortlisted' && (
            <button
              onClick={() => onStatusChange(job.id, 'applied')}
              className="rounded p-1 text-zinc-500 transition-colors hover:bg-blue-500/10 hover:text-blue-400"
              title="Mark as Applied"
            >
              <Send size={14} />
            </button>
          )}
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-300"
            title="Open original"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  )
}
