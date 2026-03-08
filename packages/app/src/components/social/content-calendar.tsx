import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { SocialPost, SocialPlatform } from '@zync/shared/types'
import * as socialService from '@/services/social'
import toast from 'react-hot-toast'

type ViewMode = 'week' | 'month'

const statusColors: Record<string, string> = {
  draft: 'bg-zinc-500',
  scheduled: 'bg-blue-500',
  published: 'bg-emerald-500',
}

const statusBorders: Record<string, string> = {
  draft: 'border-zinc-500/40',
  scheduled: 'border-blue-500/40',
  published: 'border-emerald-500/40',
}

interface ContentCalendarProps {
  platform: SocialPlatform
}

function getPostThumb(post: SocialPost): string | null {
  if (post.media_ids) {
    try {
      const ids: number[] = JSON.parse(post.media_ids)
      if (ids.length > 0) return `/api/social/media/${ids[0]}/thumb`
    } catch { /* */ }
  }
  return post.media_url || null
}

const SLOTS = Array.from({ length: 12 }, (_, i) => i * 2) // 0, 2, 4, ..., 22
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SLOT_HEIGHT = 120 // px per 2-hour slot

/** Local YYYY-MM-DD (avoids UTC timezone shift from toISOString) */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ContentCalendar({ platform }: ContentCalendarProps) {
  const navigate = useNavigate()
  const [view, setView] = useState<ViewMode>('week') // default week
  const [currentDate, setCurrentDate] = useState(new Date())
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [dragPost, setDragPost] = useState<SocialPost | null>(null)
  const weekGridRef = useRef<HTMLDivElement>(null)

  const { start, end, days } = useMemo(() => {
    if (view === 'week') {
      const dayOfWeek = currentDate.getDay()
      const s = new Date(currentDate)
      s.setDate(s.getDate() - dayOfWeek)
      s.setHours(0, 0, 0, 0)
      const e = new Date(s)
      e.setDate(e.getDate() + 6)
      e.setHours(23, 59, 59, 999)
      const d: Date[] = []
      for (let i = 0; i < 7; i++) { const day = new Date(s); day.setDate(day.getDate() + i); d.push(day) }
      return { start: s, end: e, days: d }
    } else {
      const s = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const e = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      e.setHours(23, 59, 59, 999)
      const startPad = new Date(s); startPad.setDate(startPad.getDate() - startPad.getDay())
      const d: Date[] = []; const cur = new Date(startPad)
      while (cur <= e || d.length % 7 !== 0) { d.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
      return { start: startPad, end: new Date(d[d.length - 1]), days: d }
    }
  }, [currentDate, view])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    socialService.getCalendarPosts(start.toISOString(), end.toISOString(), platform)
      .then((data) => { if (!cancelled) setPosts(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [start, end, platform])

  // Scroll to 8am on mount in week view
  useEffect(() => {
    if (view === 'week' && weekGridRef.current && !loading) {
      weekGridRef.current.scrollTop = 4 * SLOT_HEIGHT // scroll to 8am
    }
  }, [view, loading])

  const postsByDate = useMemo(() => {
    const map: Record<string, SocialPost[]> = {}
    for (const post of posts) {
      const dateStr = localDateStr(new Date(post.scheduled_for || post.posted_at || post.created_at))
      if (!map[dateStr]) map[dateStr] = []
      map[dateStr].push(post)
    }
    return map
  }, [posts])

  const nav = (dir: number) => {
    const next = new Date(currentDate)
    if (view === 'week') next.setDate(next.getDate() + dir * 7)
    else next.setMonth(next.getMonth() + dir)
    setCurrentDate(next)
  }

  const handleDropMonth = async (e: React.DragEvent, date: Date) => {
    e.preventDefault()
    if (!dragPost || (dragPost.status !== 'draft' && dragPost.status !== 'scheduled')) return
    const newDate = new Date(date); newDate.setHours(10, 0, 0, 0)
    try {
      await socialService.updatePost(dragPost.id, { scheduled_for: newDate.toISOString() })
      toast.success('Post rescheduled')
      const data = await socialService.getCalendarPosts(start.toISOString(), end.toISOString(), platform)
      setPosts(data)
    } catch { toast.error('Failed to reschedule') }
    setDragPost(null)
  }

  const handleDropWeek = useCallback(async (e: React.DragEvent, dayIdx: number) => {
    e.preventDefault()
    if (!dragPost || (dragPost.status !== 'draft' && dragPost.status !== 'scheduled')) return
    const gridRect = weekGridRef.current?.getBoundingClientRect()
    if (!gridRect) return

    const scrollTop = weekGridRef.current?.scrollTop || 0
    const yInGrid = e.clientY - gridRect.top + scrollTop
    const totalMinutes = Math.max(0, Math.min(23 * 60 + 59, Math.round((yInGrid / (SLOT_HEIGHT / 2)) * 60)))
    const hour = Math.floor(totalMinutes / 60)
    const minutes = Math.round((totalMinutes % 60) / 15) * 15 // snap to 15 min

    const newDate = new Date(days[dayIdx])
    newDate.setHours(hour, minutes >= 60 ? 0 : minutes, 0, 0)
    if (minutes >= 60) newDate.setHours(hour + 1)

    try {
      await socialService.updatePost(dragPost.id, { scheduled_for: newDate.toISOString() })
      toast.success(`Rescheduled to ${DAY_NAMES[dayIdx]} ${hour}:${String(minutes % 60).padStart(2, '0')}`)
      const data = await socialService.getCalendarPosts(start.toISOString(), end.toISOString(), platform)
      setPosts(data)
    } catch { toast.error('Failed to reschedule') }
    setDragPost(null)
  }, [dragPost, days, start, end, platform])

  const today = localDateStr(new Date())
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  const headerLabel = view === 'week'
    ? `${days[0]?.toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${days[6]?.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : monthName

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)} className="p-1 text-zinc-500 hover:text-zinc-300"><ChevronLeft size={18} /></button>
          <h2 className="text-lg font-semibold text-zinc-100 min-w-[220px] text-center">{headerLabel}</h2>
          <button onClick={() => nav(1)} className="p-1 text-zinc-500 hover:text-zinc-300"><ChevronRight size={18} /></button>
          <button onClick={() => setCurrentDate(new Date())} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded border border-white/[0.06]">Today</button>
        </div>
        <div className="flex gap-1">
          {(['week', 'month'] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors capitalize',
                view === v ? 'bg-white/[0.1] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-zinc-500" /></div>
      ) : view === 'week' ? (
        <WeekView
          days={days}
          posts={posts}
          today={today}
          gridRef={weekGridRef}
          onDragStart={setDragPost}
          onDrop={handleDropWeek}
          onPostClick={(p) => navigate(`/social/create/${p.id}`)}
          onSlotClick={(day, hour) => {
            const d = new Date(day); d.setHours(hour, 0, 0, 0)
            navigate(`/social/create?platform=${platform}&schedule=${d.toISOString()}`)
          }}
        />
      ) : (
        <MonthView
          days={days}
          currentDate={currentDate}
          postsByDate={postsByDate}
          today={today}
          onDragStart={setDragPost}
          onDrop={handleDropMonth}
          onPostClick={(p) => navigate(`/social/create/${p.id}`)}
        />
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 justify-end flex-shrink-0">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn('h-2 w-2 rounded-full', color)} />
            <span className="text-[10px] text-zinc-500 capitalize">{status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Week View — full time grid
// ============================================================

function WeekView({ days, posts, today, gridRef, onDragStart, onDrop, onPostClick, onSlotClick }: {
  days: Date[]
  posts: SocialPost[]
  today: string
  gridRef: React.RefObject<HTMLDivElement>
  onDragStart: (post: SocialPost) => void
  onDrop: (e: React.DragEvent, dayIdx: number) => void
  onPostClick: (post: SocialPost) => void
  onSlotClick: (day: Date, hour: number) => void
}) {
  // Group posts by day index and compute position
  const postsByDay = useMemo(() => {
    const map: Record<number, Array<SocialPost & { top: number }>> = {}
    for (let i = 0; i < 7; i++) map[i] = []

    for (const post of posts) {
      const dateStr = (post.scheduled_for || post.posted_at || post.created_at)
      const d = new Date(dateStr)
      const dayIdx = days.findIndex((day) => localDateStr(day) === localDateStr(d))
      if (dayIdx === -1) continue
      const hours = d.getHours() + d.getMinutes() / 60
      map[dayIdx].push({ ...post, top: (hours / 2) * SLOT_HEIGHT })
    }
    return map
  }, [posts, days])

  const nowHour = new Date().getHours() + new Date().getMinutes() / 60

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-white/[0.06] flex-shrink-0">
        <div /> {/* time gutter spacer */}
        {days.map((day, i) => {
          const dateStr = localDateStr(day)
          const isToday = dateStr === today
          return (
            <div key={i} className={cn('text-center py-2 border-l border-white/[0.04]', isToday && 'bg-indigo-500/5')}>
              <div className="text-[10px] text-zinc-500">{DAY_NAMES[i]}</div>
              <div className={cn('text-sm font-medium', isToday ? 'text-indigo-400' : 'text-zinc-300')}>
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={gridRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] relative" style={{ height: 12 * SLOT_HEIGHT }}>
          {/* Time gutter */}
          <div className="relative">
            {SLOTS.map((h) => (
              <div key={h} className="absolute right-2 text-[10px] text-zinc-600 -translate-y-1/2" style={{ top: (h / 2) * SLOT_HEIGHT }}>
                {h === 0 ? '' : `${h.toString().padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIdx) => {
            const dateStr = localDateStr(day)
            const isToday = dateStr === today
            const dayPosts = postsByDay[dayIdx] || []

            return (
              <div
                key={dayIdx}
                className={cn('relative border-l border-white/[0.04]', isToday && 'bg-indigo-500/[0.03]')}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, dayIdx)}
              >
                {/* 2-hour slot rows */}
                {SLOTS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-white/[0.06] cursor-pointer hover:bg-white/[0.02] group"
                    style={{ top: (h / 2) * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                    onClick={() => onSlotClick(day, h)}
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus size={14} className="text-zinc-600" />
                    </div>
                    {/* Half-slot dashed line at the odd hour */}
                    <div className="absolute left-0 right-0 border-t border-dashed border-white/[0.03]" style={{ top: SLOT_HEIGHT / 2 }} />
                  </div>
                ))}

                {/* Now indicator */}
                {isToday && (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: (nowHour / 2) * SLOT_HEIGHT }}>
                    <div className="flex items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-rose-500 -ml-1" />
                      <div className="flex-1 h-[2px] bg-rose-500" />
                    </div>
                  </div>
                )}

                {/* Post cards */}
                {dayPosts.map((post) => {
                  const thumb = getPostThumb(post)
                  return (
                    <div
                      key={post.id}
                      draggable
                      onDragStart={() => onDragStart(post)}
                      onClick={(e) => { e.stopPropagation(); onPostClick(post) }}
                      className={cn(
                        'absolute left-1 right-1 z-10 rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing',
                        'hover:ring-1 hover:ring-white/20 transition-shadow bg-zinc-900/90 backdrop-blur-sm',
                        statusBorders[post.status] || 'border-zinc-500/40',
                      )}
                      style={{ top: post.top, height: SLOT_HEIGHT - 8 }}
                    >
                      {/* Thumbnail on top */}
                      {thumb && (
                        <div className="w-full h-14 flex-shrink-0">
                          <img src={thumb} alt="" className="h-full w-full object-cover" />
                        </div>
                      )}
                      {/* Text below */}
                      <div className="px-2 py-1.5 flex flex-col justify-between flex-1 min-h-0" style={{ height: thumb ? SLOT_HEIGHT - 8 - 56 : SLOT_HEIGHT - 8 }}>
                        <p className="text-[11px] text-zinc-300 line-clamp-2 leading-snug">
                          {post.content?.slice(0, 80) || 'No caption'}
                        </p>
                        <div className="flex items-center gap-1 mt-auto">
                          <div className={cn('h-2 w-2 rounded-full flex-shrink-0', statusColors[post.status])} />
                          <span className="text-[10px] text-zinc-500 capitalize">{post.status}</span>
                          <span className="text-[10px] text-zinc-600 ml-auto">
                            {new Date(post.scheduled_for || post.posted_at || post.created_at).toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Month View — compact grid
// ============================================================

function MonthView({ days, currentDate, postsByDate, today, onDragStart, onDrop, onPostClick }: {
  days: Date[]
  currentDate: Date
  postsByDate: Record<string, SocialPost[]>
  today: string
  onDragStart: (post: SocialPost) => void
  onDrop: (e: React.DragEvent, date: Date) => void
  onPostClick: (post: SocialPost) => void
}) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-zinc-500 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateStr = localDateStr(day)
          const dayPosts = postsByDate[dateStr] || []
          const isToday = dateStr === today
          const isCurrentMonth = day.getMonth() === currentDate.getMonth()
          return (
            <div key={dateStr}
              className={cn('min-h-[80px] rounded-lg border p-1.5 transition-colors',
                isToday ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-white/[0.04] bg-white/[0.01]',
                !isCurrentMonth && 'opacity-40')}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, day)}>
              <div className={cn('text-[10px] font-medium mb-1', isToday ? 'text-indigo-400' : 'text-zinc-500')}>{day.getDate()}</div>
              <div className="space-y-0.5">
                {dayPosts.slice(0, 3).map((post) => {
                  const thumb = getPostThumb(post)
                  return (
                    <div key={post.id} draggable onDragStart={() => onDragStart(post)} onClick={() => onPostClick(post)}
                      className={cn('flex items-center gap-1 rounded overflow-hidden cursor-grab hover:brightness-110 border',
                        statusBorders[post.status] || 'border-zinc-500/40', 'bg-zinc-900/80')}
                      title={post.content}>
                      {thumb && <img src={thumb} alt="" className="h-5 w-5 object-cover flex-shrink-0" />}
                      <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', statusColors[post.status])} />
                      <span className="text-[9px] text-zinc-300 truncate pr-1">{post.content?.slice(0, 20) || 'No caption'}</span>
                    </div>
                  )
                })}
                {dayPosts.length > 3 && <div className="text-[9px] text-zinc-500 px-1">+{dayPosts.length - 3} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
