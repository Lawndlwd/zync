import { useState } from 'react'
import { Users, ChevronDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useGitlabContributors } from '@/hooks/useGitlab'

interface ContributorsListProps {
  projectId: number | null
}

export function GitLabContributorsList({ projectId }: ContributorsListProps) {
  const [open, setOpen] = useState(true)
  const { data: contributors, isLoading } = useGitlabContributors(projectId)

  if (!projectId) return null

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 mb-3 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-colors"
      >
        <Users size={16} className="text-emerald-400" />
        Contributors
        {contributors && (
          <span className="text-xs text-zinc-500 font-normal">({contributors.length})</span>
        )}
        <ChevronDown
          size={14}
          className={`text-zinc-500 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>

      {open && (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] overflow-hidden">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-8 rounded" />
              ))}
            </div>
          ) : contributors && contributors.length > 0 ? (
            <div className="divide-y divide-white/[0.05]">
              {/* Header */}
              <div className="flex items-center px-3 py-2 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
                <span className="w-8 text-center">#</span>
                <span className="flex-1 ml-2">Name</span>
                <span className="w-16 text-right">Commits</span>
              </div>
              {contributors.map((c, i) => (
                <div
                  key={c.name}
                  className="flex items-center px-3 py-2 text-sm hover:bg-white/[0.04] transition-colors"
                >
                  <span className="w-8 text-center text-xs text-zinc-600">{i + 1}</span>
                  <div className="flex-1 ml-2 min-w-0">
                    <span className="block truncate text-zinc-200">{c.name}</span>
                    <span className="block truncate text-[11px] text-zinc-500">
                      {c.emails.join(', ')}
                    </span>
                  </div>
                  <span className="w-16 text-right font-mono text-xs text-zinc-100 font-medium shrink-0">
                    {c.commits.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-zinc-500">No contributors found</div>
          )}
          <div className="px-3 py-2 text-[10px] text-zinc-600">
            Main branch. Excludes merge commits. Limited to 6,000 commits. Cached 1h.
          </div>
        </div>
      )}
    </div>
  )
}
