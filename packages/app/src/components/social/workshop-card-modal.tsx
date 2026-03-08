import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Tag, FileText, Columns, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkshopCard, WorkshopColumn } from '@zync/shared/types'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { MilkdownEditor } from '@/components/ui/milkdown-editor'

const COLUMNS: Array<{ id: WorkshopColumn; label: string; color: string; dot: string }> = [
    { id: 'ideas', label: 'Ideas', color: 'border-amber-500/40  bg-amber-500/10  text-amber-400', dot: 'bg-amber-400' },
    { id: 'review', label: 'Review', color: 'border-blue-500/40   bg-blue-500/10   text-blue-400', dot: 'bg-blue-400' },
    { id: 'ready', label: 'Ready', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400', dot: 'bg-emerald-400' },
]

export interface CardFormValues {
    title: string
    description: string
    tags: string
    notes: string
    column_name: WorkshopColumn
}

interface WorkshopCardModalProps {
    card?: WorkshopCard | null
    defaultColumn?: WorkshopColumn
    onClose: () => void
    onSave: (values: CardFormValues) => Promise<void>
}

function parseTags(raw: string): string {
    try {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) return arr.join(', ')
        return raw
    } catch {
        return raw
    }
}

/** Combine description + notes into a single markdown body with a separator */
function combineContent(description: string, notes: string): string {
    const desc = description?.trim() ?? ''
    const n = notes?.trim() ?? ''
    if (!desc && !n) return ''
    if (!n) return desc
    if (!desc) return `---\n\n## Notes\n\n${n}`
    return `${desc}\n\n---\n\n## Notes\n\n${n}`
}

/** Split combined markdown back into description + notes */
function splitContent(combined: string): { description: string; notes: string } {
    const separator = /\n---\n+## Notes\n/
    const match = combined.match(separator)
    if (!match || match.index === undefined) return { description: combined.trimEnd(), notes: '' }
    return {
        description: combined.slice(0, match.index).trimEnd(),
        notes: combined.slice(match.index + match[0].length).trimEnd(),
    }
}

export function WorkshopCardModal({ card, defaultColumn = 'ideas', onClose, onSave }: WorkshopCardModalProps) {
    const isEdit = !!card

    const [title, setTitle] = useState(card?.title ?? '')
    const [tags, setTags] = useState(card ? parseTags(card.tags) : '')
    const [column, setColumn] = useState<WorkshopColumn>(card?.column_name ?? defaultColumn)
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState<{ title?: string }>({})

    const [content, setContent] = useState(() => combineContent(card?.description ?? '', card?.notes ?? ''))
    const contentRef = useRef(content)
    const handleContentChange = useCallback((v: string) => { contentRef.current = v; setContent(v) }, [])

    const titleRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setTimeout(() => titleRef.current?.focus(), 60)
    }, [])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [onClose])

    const validate = () => {
        if (!title.trim()) {
            setErrors({ title: 'Title is required' })
            titleRef.current?.focus()
            return false
        }
        setErrors({})
        return true
    }

    const handleSubmit = async () => {
        if (!validate()) return
        setSaving(true)
        try {
            const { description, notes } = splitContent(contentRef.current)
            await onSave({ title: title.trim(), description, tags: tags.trim(), notes, column_name: column })
            onClose()
        } catch {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50">
            <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel defaultSize="55%" minSize="15%" onClick={onClose} className="cursor-pointer bg-black/40" />
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize="45%" minSize="360px" maxSize="85%">
                    <div className="flex h-full flex-col bg-[#1a1d1e]/95 backdrop-blur-md shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
                            <div>
                                <h2 className="text-sm font-semibold text-zinc-100">
                                    {isEdit ? 'Edit Card' : 'Create Card'}
                                </h2>
                                <p className="text-xs text-zinc-500 mt-0.5">
                                    {isEdit ? 'Update the details of this card' : 'Add a new card to the board'}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
                            {/* Column selector */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-2">
                                    <Columns size={12} />
                                    Column
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                    {COLUMNS.map((col) => (
                                        <button
                                            key={col.id}
                                            type="button"
                                            onClick={() => setColumn(col.id)}
                                            className={cn(
                                                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                                                column === col.id
                                                    ? col.color
                                                    : 'border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                                            )}
                                        >
                                            <span className={cn('w-1.5 h-1.5 rounded-full', column === col.id ? col.dot : 'bg-zinc-600')} />
                                            {col.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-1.5">
                                    <FileText size={12} />
                                    Title <span className="text-red-400">*</span>
                                </label>
                                <input
                                    ref={titleRef}
                                    type="text"
                                    value={title}
                                    onChange={(e) => { setTitle(e.target.value); setErrors({}) }}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit() }}
                                    placeholder="Card title..."
                                    className={cn(
                                        'w-full rounded-lg border bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition-colors',
                                        errors.title
                                            ? 'border-red-500/50 focus:border-red-500/70'
                                            : 'border-white/[0.08] focus:border-indigo-500/50'
                                    )}
                                />
                                {errors.title && (
                                    <p className="text-[10px] text-red-400 mt-1">{errors.title}</p>
                                )}
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-1.5">
                                    <Tag size={12} />
                                    Tags
                                    <span className="text-zinc-600 font-normal">— comma-separated</span>
                                </label>
                                <input
                                    type="text"
                                    value={tags}
                                    onChange={(e) => setTags(e.target.value)}
                                    placeholder="content, reel, trending..."
                                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                                />
                                {tags.trim() && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                                            <span key={t} className="inline-flex items-center gap-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-400">
                                                <Tag size={8} />
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Content (description + notes) */}
                            <div className="flex-1 flex flex-col min-h-0">
                                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-1.5">
                                    <FileText size={12} />
                                    Content
                                    <span className="text-zinc-600 font-normal">— use --- + ## Notes to separate notes</span>
                                </label>
                                <MilkdownEditor
                                    value={content}
                                    onChange={handleContentChange}
                                    placeholder="Write your description... Add --- and ## Notes for notes section"
                                    variant="borderless"
                                    minHeight="200px"
                                    className="flex-1"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06] shrink-0">
                            <button
                                onClick={onClose}
                                disabled={saving}
                                className="rounded-lg px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-medium text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {saving && <Loader2 size={12} className="animate-spin" />}
                                {isEdit ? 'Save Changes' : 'Create Card'}
                            </button>
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    )
}
