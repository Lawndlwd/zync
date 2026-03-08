import { useState } from 'react'
import { Plus, ChevronDown, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkshopBoard } from '@/types/social'

interface BoardSelectorProps {
  boards: WorkshopBoard[]
  selectedId: number | null
  onSelect: (id: number) => void
  onCreate: (name: string) => void
  onDelete: (id: number) => void
  isLoading: boolean
}

export function WorkshopBoardSelector({ boards, selectedId, onSelect, onCreate, onDelete, isLoading }: BoardSelectorProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const selected = boards.find((b) => b.id === selectedId)

  const handleCreate = () => {
    if (!newName.trim()) return
    onCreate(newName.trim())
    setNewName('')
    setCreating(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200 hover:border-white/[0.15] transition-colors"
      >
        {isLoading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <>
            <span className="max-w-[200px] truncate">{selected?.name || 'Select Board'}</span>
            <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
          </>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-xl border border-white/[0.08] bg-zinc-900 shadow-xl py-1">
            {boards.map((board) => (
              <div
                key={board.id}
                className={cn(
                  'flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] cursor-pointer group',
                  board.id === selectedId && 'bg-white/[0.06]'
                )}
              >
                <button
                  className="flex-1 text-left text-sm text-zinc-300"
                  onClick={() => { onSelect(board.id); setOpen(false) }}
                >
                  {board.name}
                  <span className="text-[10px] text-zinc-600 ml-2">{board.platform}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(board.id) }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {boards.length === 0 && !creating && (
              <p className="px-3 py-2 text-xs text-zinc-600">No boards yet</p>
            )}

            <div className="border-t border-white/[0.06] mt-1 pt-1">
              {creating ? (
                <div className="px-3 py-2 flex gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                    placeholder="Board name..."
                    autoFocus
                    className="flex-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                  />
                  <button onClick={handleCreate} className="text-indigo-400 hover:text-indigo-300 text-xs font-medium">
                    Add
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-indigo-400 hover:bg-white/[0.04]"
                >
                  <Plus size={14} />
                  New Board
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
