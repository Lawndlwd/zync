import { useState } from 'react'
import { GripVertical, X, Tag, Pencil } from 'lucide-react'
import type { WorkshopCard as CardType } from '@zync/shared/types'
import { WorkshopCardModal, type CardFormValues } from './workshop-card-modal'

interface WorkshopCardProps {
  card: CardType
  onDelete: (id: number) => void
  onEdit: (id: number, values: CardFormValues) => Promise<void>
}

export function WorkshopCard({ card, onDelete, onEdit }: WorkshopCardProps) {
  const [editOpen, setEditOpen] = useState(false)

  const tags: string[] = (() => {
    try { return JSON.parse(card.tags) } catch { return [] }
  })()

  return (
    <>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', String(card.id))
          e.dataTransfer.effectAllowed = 'move'
        }}
        onClick={() => setEditOpen(true)}
        className="group rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 cursor-pointer active:cursor-grabbing hover:border-white/[0.12] hover:bg-white/[0.05] transition-all"
      >
        <div className="flex items-start gap-2">
          <GripVertical
            size={14}
            className="text-zinc-600 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <p className="text-sm text-zinc-200 font-medium leading-snug">{card.title}</p>
              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditOpen(true) }}
                  className="text-zinc-600 hover:text-indigo-400 transition-colors"
                  title="Edit card"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(card.id) }}
                  className="text-zinc-600 hover:text-red-400 transition-colors"
                  title="Delete card"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {card.description && (
              <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{card.description}</p>
            )}

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-0.5 rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-400"
                  >
                    <Tag size={8} />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {card.notes && (
              <p className="mt-1.5 text-[10px] text-zinc-600 italic line-clamp-1">
                📝 {card.notes}
              </p>
            )}
          </div>
        </div>
      </div>

      {editOpen && (
        <WorkshopCardModal
          card={card}
          onClose={() => setEditOpen(false)}
          onSave={(values) => onEdit(card.id, values)}
        />
      )}
    </>
  )
}
