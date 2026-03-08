import { useState } from 'react'
import type { Job } from '@zync/shared/types'
import { useJobDocs, useGenerateCoverLetter, useGenerateInterviewPrep } from '@/hooks/useJobs'
import { Building2, MapPin, ExternalLink, FileText, BookOpen, Loader2, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface JobDetailDrawerProps {
  job: Job | null
  onClose: () => void
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-zinc-500">Not scored</span>
  const color =
    score >= 8 ? 'text-emerald-400' :
    score >= 5 ? 'text-amber-400' :
    'text-red-400'
  return <span className={cn('text-2xl font-bold', color)}>{score}<span className="text-sm text-zinc-500">/10</span></span>
}

export function JobDetailDrawer({ job, onClose }: JobDetailDrawerProps) {
  const { data: docs } = useJobDocs(job?.id)
  const coverLetterMutation = useGenerateCoverLetter()
  const interviewPrepMutation = useGenerateInterviewPrep()
  const [activeTab, setActiveTab] = useState<'details' | 'docs'>('details')

  if (!job) return null

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-white/[0.08] bg-zinc-950/95 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/[0.08] p-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-zinc-100">{job.title}</h2>
          <div className="mt-1 flex items-center gap-3 text-sm text-zinc-400">
            <span className="flex items-center gap-1"><Building2 size={14} /> {job.company}</span>
            {job.location && <span className="flex items-center gap-1"><MapPin size={14} /> {job.location}</span>}
          </div>
          {job.salary && <p className="mt-1 text-sm text-emerald-400">{job.salary}</p>}
        </div>
        <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
          <X size={20} />
        </button>
      </div>

      {/* Score + Actions */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-3">
          <ScoreBadge score={job.score} />
          {job.score_reasons && (
            <p className="text-xs text-zinc-500 line-clamp-2">{job.score_reasons}</p>
          )}
        </div>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/[0.05]"
        >
          <ExternalLink size={12} /> Original
        </a>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.08]">
        <button
          onClick={() => setActiveTab('details')}
          className={cn(
            'flex-1 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'details' ? 'border-b-2 border-indigo-500 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          Details
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={cn(
            'flex-1 px-4 py-2.5 text-sm font-medium transition-colors',
            activeTab === 'docs' ? 'border-b-2 border-indigo-500 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          Documents {docs && docs.length > 0 && <span className="ml-1 text-xs text-zinc-500">({docs.length})</span>}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'details' && (
          <div className="space-y-4">
            {job.company_insight && (
              <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Company Insight</h3>
                </div>
                <p className="text-sm leading-relaxed text-emerald-200/80">{job.company_insight}</p>
              </div>
            )}
            {job.description ? (
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-300">Description</h3>
                <p className="whitespace-pre-wrap text-sm text-zinc-400">{job.description}</p>
              </div>
            ) : (
              <p className="text-sm text-zinc-600">No description available. Visit the original posting for details.</p>
            )}
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="space-y-4">
            {/* Generate buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => coverLetterMutation.mutate(job.id)}
                disabled={coverLetterMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-white/[0.05] disabled:opacity-50"
              >
                {coverLetterMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                Generate Cover Letter
              </button>
              <button
                onClick={() => interviewPrepMutation.mutate(job.id)}
                disabled={interviewPrepMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-white/[0.05] disabled:opacity-50"
              >
                {interviewPrepMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
                Generate Interview Prep
              </button>
            </div>

            {/* Existing docs */}
            {docs?.map(doc => (
              <div key={doc.id} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase text-zinc-400">
                    {doc.doc_type === 'cover_letter' ? 'Cover Letter' : 'Interview Prep'}
                  </span>
                  <span className="text-[10px] text-zinc-600">{new Date(doc.created_at).toLocaleDateString()}</span>
                </div>
                <div className="whitespace-pre-wrap text-sm text-zinc-300">{doc.content}</div>
              </div>
            ))}

            {(!docs || docs.length === 0) && !coverLetterMutation.isPending && !interviewPrepMutation.isPending && (
              <p className="py-4 text-center text-xs text-zinc-600">No documents generated yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
