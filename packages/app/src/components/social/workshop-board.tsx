import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkshopCard as CardType, WorkshopColumn } from '@zync/shared/types'
import { WorkshopCard } from './workshop-card'
import { WorkshopCardModal, type CardFormValues } from './workshop-card-modal'
import * as socialService from '@/services/social'

const COLUMNS: Array<{ id: WorkshopColumn; label: string; color: string }> = [
  { id: 'ideas', label: 'Ideas', color: 'border-t-amber-500/50' },
  { id: 'review', label: 'Review', color: 'border-t-blue-500/50' },
  { id: 'ready', label: 'Ready', color: 'border-t-emerald-500/50' },
]

interface WorkshopBoardProps {
  boardId: number
  refreshKey: number
  onDiscussColumn?: (columnLabel: string, cards: CardType[]) => void
}

export function WorkshopBoard({ boardId, refreshKey, onDiscussColumn }: WorkshopBoardProps) {
  const [cards, setCards] = useState<CardType[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOverColumn, setDragOverColumn] = useState<WorkshopColumn | null>(null)

  // Modal state
  const [createColumn, setCreateColumn] = useState<WorkshopColumn | null>(null) // which column to create in
  const [editCard, setEditCard] = useState<CardType | null>(null)

  const loadCards = useCallback(() => {
    setLoading(true)
    socialService.getWorkshopCards(boardId)
      .then(setCards)
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [boardId])

  useEffect(() => { loadCards() }, [loadCards, refreshKey])

  /* ── Drag & drop ── */
  const handleDrop = async (e: React.DragEvent, column: WorkshopColumn) => {
    e.preventDefault()
    setDragOverColumn(null)
    const cardId = Number(e.dataTransfer.getData('text/plain'))
    if (!cardId) return

    setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, column_name: column } : c))
    try {
      await socialService.updateWorkshopCard(cardId, { column_name: column })
    } catch {
      loadCards()
    }
  }

  /* ── Create card ── */
  const handleCreateCard = async (column: WorkshopColumn, values: CardFormValues) => {
    const tags = values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined
    await socialService.createWorkshopCard(boardId, {
      title: values.title,
      description: values.description || undefined,
      column_name: column,
      tags,
    })
    loadCards()
  }

  /* ── Edit card ── */
  const handleEditCard = async (id: number, values: CardFormValues) => {
    const tags = values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
    await socialService.updateWorkshopCard(id, {
      title: values.title,
      description: values.description || undefined,
      column_name: values.column_name,
      tags,
      notes: values.notes || undefined,
    })
    // optimistic update
    setCards((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
            ...c,
            title: values.title,
            description: values.description,
            column_name: values.column_name,
            tags: JSON.stringify(tags),
            notes: values.notes,
          }
          : c
      )
    )
  }

  /* ── Delete card ── */
  const handleDeleteCard = async (id: number) => {
    setCards((prev) => prev.filter((c) => c.id !== id))
    try {
      await socialService.deleteWorkshopCard(id)
    } catch {
      loadCards()
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 size={24} className="animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <>
      <div className="flex gap-3 h-full min-h-0">
        {COLUMNS.map((col) => {
          const colCards = cards.filter((c) => c.column_name === col.id)
          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.id) }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={cn(
                'flex-1 flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.01] border-t-2 transition-colors min-w-0',
                col.color,
                dragOverColumn === col.id && 'bg-white/[0.04] border-white/[0.12]'
              )}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-zinc-300">{col.label}</h3>
                  <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-500 font-medium">
                    {colCards.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {onDiscussColumn && colCards.length > 0 && (
                    <button
                      onClick={() => onDiscussColumn(col.label, colCards)}
                      className="text-zinc-600 hover:text-indigo-400 transition-colors"
                      title={`Discuss ${col.label} cards with AI`}
                    >
                      <MessageCircle size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => setCreateColumn(col.id)}
                    className="text-zinc-600 hover:text-zinc-300 transition-colors"
                    title={`Add card to ${col.label}`}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-0">
                {colCards.map((card) => (
                  <WorkshopCard
                    key={card.id}
                    card={card}
                    onDelete={handleDeleteCard}
                    onEdit={handleEditCard}
                  />
                ))}

                {colCards.length === 0 && (
                  <p className="text-center text-[10px] text-zinc-700 py-4">Drop cards here</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Create modal */}
      {createColumn && (
        <WorkshopCardModal
          defaultColumn={createColumn}
          onClose={() => setCreateColumn(null)}
          onSave={(values) => handleCreateCard(createColumn, values)}
        />
      )}

      {/* Edit modal */}
      {editCard && (
        <WorkshopCardModal
          card={editCard}
          onClose={() => setEditCard(null)}
          onSave={(values) => handleEditCard(editCard.id, values)}
        />
      )}
    </>
  )
}
