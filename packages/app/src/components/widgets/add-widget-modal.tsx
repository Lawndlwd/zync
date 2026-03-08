import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createWidget, refreshWidget, fetchFootballLeagues, type WidgetType } from '@/services/widgets'
import { Cloud, Trophy, Newspaper, TrendingUp, ArrowLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const WIDGET_TYPES = [
  { type: 'weather' as WidgetType, icon: Cloud, color: 'text-sky-400', bg: 'bg-sky-400/10', label: 'Weather', desc: 'Real-time weather for your city' },
  { type: 'football' as WidgetType, icon: Trophy, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Football', desc: 'Live scores by league' },
  { type: 'news' as WidgetType, icon: Newspaper, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'News', desc: 'Top 3 trending headlines' },
  { type: 'finance' as WidgetType, icon: TrendingUp, color: 'text-violet-400', bg: 'bg-violet-400/10', label: 'Finance', desc: 'Top 3 financial insights' },
] as const

const FINANCE_OPTIONS = ['crypto', 'stocks', 'savings', 'real estate', 'budgeting']

export function AddWidgetModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState<'pick' | 'config'>('pick')
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null)

  // Weather
  const [city, setCity] = useState('Paris')

  // Football
  const [selectedLeague, setSelectedLeague] = useState('eng.1')
  const { data: leagues = [] } = useQuery({
    queryKey: ['football-leagues'],
    queryFn: fetchFootballLeagues,
    staleTime: Infinity,
    enabled: open && selectedType === 'football',
  })

  // News
  const [topics, setTopics] = useState('technology, world')

  // Finance
  const [focus, setFocus] = useState<string[]>(['savings'])

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedType) throw new Error('No type selected')
      let settings: Record<string, any> = {}
      switch (selectedType) {
        case 'weather': settings = { city }; break
        case 'football': settings = { league: selectedLeague }; break
        case 'news': settings = { topics: topics.split(',').map(t => t.trim()).filter(Boolean) }; break
        case 'finance': settings = { focus }; break
      }
      const widget = await createWidget(selectedType, settings)
      refreshWidget(widget.id).catch(() => {})
      return widget
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] })
      resetAndClose()
    },
  })

  function resetAndClose() {
    setStep('pick')
    setSelectedType(null)
    setCity('Paris')
    setSelectedLeague('eng.1')
    setTopics('technology, world')
    setFocus(['savings'])
    onOpenChange(false)
  }

  function toggleFocus(item: string) {
    setFocus(prev => prev.includes(item) ? prev.filter(f => f !== item) : [...prev, item])
  }

  const canSubmit = selectedType === 'weather' ? city.trim().length > 0
    : selectedType === 'football' ? !!selectedLeague
    : selectedType === 'news' ? topics.trim().length > 0
    : selectedType === 'finance' ? focus.length > 0
    : false

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'pick' ? 'Add Widget' : (
              <button onClick={() => setStep('pick')} className="flex items-center gap-2 text-zinc-100 hover:text-zinc-300">
                <ArrowLeft size={16} /> Configure {WIDGET_TYPES.find(w => w.type === selectedType)?.label}
              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 'pick' && (
          <div className="grid grid-cols-2 gap-3">
            {WIDGET_TYPES.map(w => (
              <button
                key={w.type}
                onClick={() => { setSelectedType(w.type); setStep('config') }}
                className="flex flex-col items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors text-center"
              >
                <div className={cn('rounded-full p-2', w.bg)}>
                  <w.icon size={20} className={w.color} />
                </div>
                <span className="text-sm font-medium text-zinc-200">{w.label}</span>
                <span className="text-xs text-zinc-500">{w.desc}</span>
              </button>
            ))}
          </div>
        )}

        {step === 'config' && selectedType === 'weather' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">City</label>
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Paris, London, Tokyo" />
            </div>
            <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending} className="w-full">
              {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Add Widget'}
            </Button>
          </div>
        )}

        {step === 'config' && selectedType === 'football' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">League</label>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {leagues.map(l => (
                  <button
                    key={l.slug}
                    onClick={() => setSelectedLeague(l.slug)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                      selectedLeague === l.slug
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'text-zinc-300 hover:bg-white/[0.06] border border-transparent'
                    )}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending} className="w-full">
              {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Add Widget'}
            </Button>
          </div>
        )}

        {step === 'config' && selectedType === 'news' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Topics (comma-separated)</label>
              <Input value={topics} onChange={e => setTopics(e.target.value)} placeholder="e.g. technology, sports, politics" />
            </div>
            <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending} className="w-full">
              {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Add Widget'}
            </Button>
          </div>
        )}

        {step === 'config' && selectedType === 'finance' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Focus areas</label>
              <div className="flex flex-wrap gap-2">
                {FINANCE_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => toggleFocus(opt)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize',
                      focus.includes(opt)
                        ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                        : 'bg-white/[0.04] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.08]'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending} className="w-full">
              {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Add Widget'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
