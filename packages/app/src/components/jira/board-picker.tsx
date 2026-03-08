import { useState, useRef, useEffect, useCallback } from 'react'
import { useJiraBoards } from '@/hooks/useJiraIssues'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Search, ChevronDown, X, LayoutGrid } from 'lucide-react'
import type { JiraBoard } from '@zync/shared/types'

interface BoardPickerProps {
  value: number | null
  onChange: (boardId: number | null) => void
  className?: string
}

// Keep a module-level cache of board names so the label persists across re-renders
const boardCache = new Map<number, JiraBoard>()

export function BoardPicker({ value, onChange, className }: BoardPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { data, isLoading } = useJiraBoards(search || undefined)
  const ref = useRef<HTMLDivElement>(null)

  const boards = data?.boards || []

  // Cache every board we see
  useEffect(() => {
    for (const b of boards) {
      boardCache.set(b.id, b)
    }
  }, [boards])

  // Resolve the display name: from current results, cache, or fallback
  const selectedBoard = value !== null
    ? boards.find((b) => b.id === value) ?? boardCache.get(value) ?? null
    : null

  const handleSelect = useCallback(
    (board: JiraBoard | null) => {
      if (board) {
        boardCache.set(board.id, board)
        onChange(board.id)
      } else {
        onChange(null)
      }
      setOpen(false)
      setSearch('')
    },
    [onChange]
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
        className="flex h-9 w-full items-center justify-between rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-zinc-300 hover:border-zinc-600 transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          <LayoutGrid size={14} className="text-zinc-500 shrink-0" />
          <span className="truncate">
            {value === null
              ? 'All issues (JQL)'
              : selectedBoard
                ? selectedBoard.name
                : `Board #${value}`}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {value !== null && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation()
                handleSelect(null)
              }}
              className="rounded p-0.5 hover:bg-white/[0.1]"
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
                placeholder="Search boards..."
                className="h-8 pl-8 text-xs"
                autoFocus
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto p-1">
            {/* "All issues" option */}
            <button
              onClick={() => handleSelect(null)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                value === null
                  ? 'bg-indigo-600/20 text-indigo-400'
                  : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
              )}
            >
              All issues (JQL)
            </button>

            {isLoading && (
              <div className="px-2.5 py-3 text-center text-xs text-zinc-500">Loading boards...</div>
            )}

            {!isLoading && boards.length === 0 && search && (
              <div className="px-2.5 py-3 text-center text-xs text-zinc-500">
                No boards matching &ldquo;{search}&rdquo;
              </div>
            )}

            {boards.map((board) => (
              <BoardOption
                key={board.id}
                board={board}
                selected={board.id === value}
                onClick={() => handleSelect(board)}
              />
            ))}

            {!isLoading && data && !data.isLast && (
              <div className="px-2.5 py-2 text-center text-xs text-zinc-500">
                {data.total - boards.length} more boards &mdash; type to search
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BoardOption({
  board,
  selected,
  onClick,
}: {
  board: JiraBoard
  selected: boolean
  onClick: () => void
}) {
  const typeColor =
    board.type === 'scrum'
      ? 'text-emerald-400 bg-emerald-500/10'
      : board.type === 'kanban'
        ? 'text-sky-400 bg-sky-500/10'
        : 'text-zinc-400 bg-white/[0.06]'

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
        selected
          ? 'bg-indigo-600/20 text-indigo-400'
          : 'text-zinc-300 hover:bg-white/[0.06]'
      )}
    >
      <div className="flex-1 min-w-0">
        <span className="block truncate">{board.name}</span>
        {board.projectKey && (
          <span className="text-xs text-zinc-500">{board.projectKey}</span>
        )}
      </div>
      <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', typeColor)}>
        {board.type}
      </span>
    </button>
  )
}
