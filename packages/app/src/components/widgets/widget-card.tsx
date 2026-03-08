import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchWidgets, refreshWidget, deleteWidget, type Widget } from '@/services/widgets'
import { AddWidgetModal } from './add-widget-modal'
import { cn } from '@/lib/utils'
import {
  Cloud, Trophy, Newspaper, TrendingUp, RefreshCw, Trash2, Plus,
  Droplets, Wind, Sun, CloudRain, CloudSnow, CloudLightning, CloudFog,
} from 'lucide-react'

// Weather icon mapper
function WeatherIcon({ code, size = 20 }: { code: string; size?: number }) {
  if (code?.includes('01')) return <Sun size={size} className="text-amber-400" />
  if (code?.includes('02') || code?.includes('03') || code?.includes('04')) return <Cloud size={size} className="text-zinc-400" />
  if (code?.includes('09') || code?.includes('10')) return <CloudRain size={size} className="text-sky-400" />
  if (code?.includes('11')) return <CloudLightning size={size} className="text-amber-300" />
  if (code?.includes('13')) return <CloudSnow size={size} className="text-blue-200" />
  if (code?.includes('50')) return <CloudFog size={size} className="text-zinc-500" />
  return <Cloud size={size} className="text-zinc-400" />
}

// ── Weather Card ─────────────────────────────────────────────────
function WeatherCardContent({ data }: { data: any }) {
  if (!data) return <p className="text-xs text-zinc-600">No data yet</p>
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <WeatherIcon code={data.icon} size={28} />
        <div>
          <span className="text-2xl font-bold text-zinc-100">{data.temp}°</span>
          <p className="text-xs text-zinc-500">Feels {data.feels_like}° · {data.condition}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
        <span className="flex items-center gap-1"><Droplets size={12} />{data.humidity}%</span>
        <span className="flex items-center gap-1"><Wind size={12} />{data.wind_speed} m/s</span>
      </div>
      {data.forecast && data.forecast.length > 0 && (
        <div className="flex gap-1">
          {data.forecast.slice(0, 3).map((f: any) => (
            <div key={f.date} className="flex-1 text-center rounded-md bg-white/[0.04] py-1.5">
              <p className="text-[10px] text-zinc-600">{f.date.slice(5)}</p>
              <WeatherIcon code={f.icon} size={14} />
              <p className="text-[10px] text-zinc-400">{Math.round(f.temp_max)}°</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Football Card ────────────────────────────────────────────────
function FootballCardContent({ data }: { data: any }) {
  if (!data || !Array.isArray(data) || data.length === 0) return <p className="text-xs text-zinc-600">No data yet</p>
  return (
    <div className="space-y-3">
      {data.map((team: any) => (
        <div key={team.id}>
          <div className="flex items-center gap-2 mb-1.5">
            {team.crest && <img src={team.crest} alt="" className="w-4 h-4" />}
            <span className="text-sm font-medium text-zinc-200">{team.name}</span>
          </div>
          {team.nextMatch && (
            <div className="rounded-md bg-white/[0.04] px-2.5 py-1.5 text-xs">
              <p className="text-zinc-500 mb-0.5">
                {['LIVE','IN_PLAY','PAUSED'].includes(team.nextMatch.status) ? 'LIVE' : 'Next'}
              </p>
              <p className="text-zinc-300">
                {team.nextMatch.homeTeam} {team.nextMatch.homeScore !== null ? `${team.nextMatch.homeScore} - ${team.nextMatch.awayScore}` : 'vs'} {team.nextMatch.awayTeam}
              </p>
              <p className="text-[10px] text-zinc-600">{team.nextMatch.competition}</p>
            </div>
          )}
          {!team.nextMatch && team.lastMatch && (
            <div className="rounded-md bg-white/[0.04] px-2.5 py-1.5 text-xs">
              <p className="text-zinc-500 mb-0.5">Last</p>
              <p className="text-zinc-300">
                {team.lastMatch.homeTeam} {team.lastMatch.homeScore} - {team.lastMatch.awayScore} {team.lastMatch.awayTeam}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── News Card ────────────────────────────────────────────────────
function NewsCardContent({ data }: { data: any }) {
  if (!data || !Array.isArray(data) || data.length === 0) return <p className="text-xs text-zinc-600">No data yet</p>
  return (
    <div className="space-y-2.5">
      {data.slice(0, 4).map((item: any, i: number) => (
        <div key={i}>
          <p className="text-xs font-medium text-zinc-200 leading-snug">{item.headline}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">{item.summary}</p>
        </div>
      ))}
    </div>
  )
}

// ── Finance Card ─────────────────────────────────────────────────
function FinanceCardContent({ data }: { data: any }) {
  if (!data || !Array.isArray(data) || data.length === 0) return <p className="text-xs text-zinc-600">No data yet</p>
  return (
    <div className="space-y-2.5">
      {data.slice(0, 4).map((tip: any, i: number) => (
        <div key={i}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="rounded-full bg-violet-500/10 text-violet-400 px-1.5 py-0.5 text-[10px] capitalize">{tip.category}</span>
          </div>
          <p className="text-xs text-zinc-300">{tip.title}</p>
          <p className="text-[10px] text-zinc-500">{tip.insight}</p>
        </div>
      ))}
    </div>
  )
}

// ── Widget Card Wrapper ──────────────────────────────────────────
const typeConfig = {
  weather: { icon: Cloud, color: 'text-sky-400', label: 'Weather' },
  football: { icon: Trophy, color: 'text-emerald-400', label: 'Football' },
  news: { icon: Newspaper, color: 'text-amber-400', label: 'News' },
  finance: { icon: TrendingUp, color: 'text-violet-400', label: 'Finance' },
} as const

function WidgetCard({ widget }: { widget: Widget }) {
  const queryClient = useQueryClient()
  const config = typeConfig[widget.type] || typeConfig.weather
  const Icon = config.icon

  const refresh = useMutation({
    mutationFn: () => refreshWidget(widget.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['widgets'] }),
  })

  const remove = useMutation({
    mutationFn: () => deleteWidget(widget.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['widgets'] }),
  })

  const subtitle = widget.type === 'weather' ? widget.settings.city
    : widget.type === 'football' ? widget.settings.teams?.map((t: any) => t.name).join(', ')
    : widget.type === 'news' ? widget.settings.topics?.join(', ')
    : widget.settings.focus?.join(', ')

  return (
    <div className="col-span-2 lg:col-span-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className={config.color} />
          <span className="text-xs font-semibold text-zinc-400 truncate">{config.label}</span>
          {subtitle && <span className="text-[10px] text-zinc-600 truncate">· {subtitle}</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="p-1 rounded hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <RefreshCw size={12} className={cn(refresh.isPending && 'animate-spin')} />
          </button>
          <button
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="p-1 rounded hover:bg-white/[0.06] text-zinc-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 min-h-0">
        {widget.type === 'weather' && <WeatherCardContent data={widget.cached_data} />}
        {widget.type === 'football' && <FootballCardContent data={widget.cached_data} />}
        {widget.type === 'news' && <NewsCardContent data={widget.cached_data} />}
        {widget.type === 'finance' && <FinanceCardContent data={widget.cached_data} />}
      </div>
      {/* Last refreshed */}
      {widget.last_refreshed && (
        <p className="text-[10px] text-zinc-600 mt-2 pt-2 border-t border-white/[0.04]">
          Updated {new Date(widget.last_refreshed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}

// ── Widgets Row (used in dashboard) ──────────────────────────────
export function WidgetsRow() {
  const [modalOpen, setModalOpen] = useState(false)
  const { data: widgets = [] } = useQuery({
    queryKey: ['widgets'],
    queryFn: fetchWidgets,
    staleTime: 60_000,
    retry: 1,
  })

  return (
    <>
      {widgets.map(w => (
        <WidgetCard key={w.id} widget={w} />
      ))}
      {/* Add widget button */}
      <button
        onClick={() => setModalOpen(true)}
        className="col-span-2 lg:col-span-3 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-3.5 flex flex-col items-center justify-center gap-2 hover:bg-white/[0.04] hover:border-white/[0.15] transition-colors min-h-[120px]"
      >
        <Plus size={20} className="text-zinc-500" />
        <span className="text-xs text-zinc-500">Add Widget</span>
      </button>
      <AddWidgetModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}
