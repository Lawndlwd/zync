import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createWidget, refreshWidget, searchFootballTeams, type WidgetType } from '@/services/widgets'
import { Cloud, Trophy, Newspaper, TrendingUp, ArrowLeft, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const WIDGET_TYPES = [
  { type: 'weather' as WidgetType, icon: Cloud, color: 'text-sky-400', bg: 'bg-sky-400/10', label: 'Weather', desc: 'Real-time weather for your city' },
  { type: 'football' as WidgetType, icon: Trophy, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Football', desc: 'Live scores for your teams' },
  { type: 'news' as WidgetType, icon: Newspaper, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'News', desc: 'AI-curated headlines' },
  { type: 'finance' as WidgetType, icon: TrendingUp, color: 'text-violet-400', bg: 'bg-violet-400/10', label: 'Finance', desc: 'AI financial tips & insights' },
] as const

const FINANCE_OPTIONS = ['crypto', 'stocks', 'savings', 'real estate', 'budgeting']

export function AddWidgetModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState<'pick' | 'config'>('pick')
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null)

  // Weather state
  const [city, setCity] = useState('Paris')

  // Football state
  const [teamQuery, setTeamQuery] = useState('')
  const [teamResults, setTeamResults] = useState<Array<{ id: number; name: string; crest: string }>>([])
  const [selectedTeams, setSelectedTeams] = useState<Array<{ id: number; name: string }>>([])
  const [searching, setSearching] = useState(false)

  // News state
  const [topics, setTopics] = useState('technology, world')

  // Finance state
  const [focus, setFocus] = useState<string[]>(['savings'])

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedType) throw new Error('No type selected')
      let settings: Record<string, any> = {}
      switch (selectedType) {
        case 'weather': settings = { city }; break
        case 'football': settings = { teams: selectedTeams }; break
        case 'news': settings = { topics: topics.split(',').map(t => t.trim()).filter(Boolean) }; break
        case 'finance': settings = { focus }; break
      }
      const widget = await createWidget(selectedType, settings)
      // Fire and forget the refresh — don't block the modal close
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
    setTeamQuery('')
    setTeamResults([])
    setSelectedTeams([])
    setTopics('technology, world')
    setFocus(['savings'])
    onOpenChange(false)
  }

  async function handleTeamSearch(q: string) {
    setTeamQuery(q)
    if (q.length < 2) { setTeamResults([]); return }
    setSearching(true)
    try {
      const results = await searchFootballTeams(q)
      setTeamResults(results.filter(r => !selectedTeams.some(s => s.id === r.id)))
    } catch { setTeamResults([]) }
    setSearching(false)
  }

  function toggleFocus(item: string) {
    setFocus(prev => prev.includes(item) ? prev.filter(f => f !== item) : [...prev, item])
  }

  const canSubmit = selectedType === 'weather' ? city.trim().length > 0
    : selectedType === 'football' ? selectedTeams.length > 0
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
              <label className="text-sm text-zinc-400 mb-1 block">Search teams</label>
              <Input value={teamQuery} onChange={e => handleTeamSearch(e.target.value)} placeholder="e.g. Arsenal, Barcelona..." />
            </div>
            {searching && <p className="text-xs text-zinc-500">Searching...</p>}
            {teamResults.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {teamResults.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTeams(prev => [...prev, { id: t.id, name: t.name }]); setTeamResults(prev => prev.filter(r => r.id !== t.id)); setTeamQuery('') }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-white/[0.06] text-sm text-zinc-200"
                  >
                    {t.crest && <img src={t.crest} alt="" className="w-5 h-5" />}
                    {t.name}
                  </button>
                ))}
              </div>
            )}
            {selectedTeams.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTeams.map(t => (
                  <span key={t.id} className="flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-400 px-3 py-1 text-xs">
                    {t.name}
                    <button onClick={() => setSelectedTeams(prev => prev.filter(s => s.id !== t.id))}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
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
