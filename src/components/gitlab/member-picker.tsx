import { useState, useRef, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Search, ChevronDown, X, User } from 'lucide-react'

interface Member {
  id: number
  username: string
  name: string
}

interface MemberPickerProps {
  value: string
  onChange: (username: string) => void
  projectId: number | null
  className?: string
}

const memberCache = new Map<string, Member>()

export function MemberPicker({ value, onChange, projectId, className }: MemberPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fetch members with search
  useEffect(() => {
    if (!projectId || !open) return
    setLoading(true)
    const params = new URLSearchParams({ per_page: '50' })
    if (search) params.set('search', search)
    fetch(`/api/gitlab/projects/${projectId}/members?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Member[]) => {
        setMembers(data)
        for (const m of data) memberCache.set(m.username, m)
      })
      .catch(() => setMembers([]))
      .finally(() => setLoading(false))
  }, [projectId, open, search])

  const selectedMember = value
    ? members.find((m) => m.username === value) ?? memberCache.get(value) ?? null
    : null

  const handleSelect = useCallback(
    (member: Member | null) => {
      if (member) {
        memberCache.set(member.username, member)
        onChange(member.username)
      } else {
        onChange('')
      }
      setOpen(false)
      setSearch('')
    },
    [onChange],
  )

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-zinc-300 hover:border-white/[0.15] transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          <User size={14} className="text-zinc-500 shrink-0" />
          <span className="truncate">
            {!value
              ? 'Select your username...'
              : selectedMember
                ? `${selectedMember.name} (${selectedMember.username})`
                : value}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation()
                handleSelect(null)
              }}
              className="rounded p-0.5 hover:bg-white/[0.08]"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] rounded-lg border border-white/[0.1] bg-[#1a1d1e]/95 backdrop-blur-md shadow-xl">
          {/* Search */}
          <div className="p-2 border-b border-white/[0.08]">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members..."
                className="h-8 pl-8 text-xs"
                autoFocus
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto p-1">
            {loading && (
              <div className="px-2.5 py-3 text-center text-xs text-zinc-500">Loading members...</div>
            )}

            {!loading && members.length === 0 && search && (
              <div className="px-2.5 py-3 text-center text-xs text-zinc-500">
                No members matching &ldquo;{search}&rdquo;
              </div>
            )}

            {!loading && members.length === 0 && !search && (
              <div className="px-2.5 py-3 text-center text-xs text-zinc-500">
                {projectId ? 'No members found' : 'Select a project first'}
              </div>
            )}

            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => handleSelect(member)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                  member.username === value
                    ? 'bg-indigo-600/20 text-indigo-400'
                    : 'text-zinc-300 hover:bg-white/[0.06]',
                )}
              >
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{member.name}</span>
                  <span className="text-xs text-zinc-500">{member.username}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
