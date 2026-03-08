import { useState } from 'react'
import type { Campaign, CampaignStatus, RemotePreference, ExperienceLevel } from '@/types/jobs'
import { useCreateCampaign, useUpdateCampaignStatus, useDeleteCampaign, useTriggerScrape, useScrapeSchedule } from '@/hooks/useJobs'
import { Play, Square, CheckCircle2, RotateCw, Plus, Trash2, Loader2, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'

interface CampaignControlsProps {
  campaigns: Campaign[]
  activeCampaignId: number | undefined
  onSelectCampaign: (id: number) => void
}

const statusConfig: Record<CampaignStatus, { label: string; color: string; dot: string }> = {
  idle: { label: 'Idle', color: 'text-zinc-400', dot: 'bg-zinc-500' },
  hunting: { label: 'Hunting', color: 'text-emerald-400', dot: 'bg-emerald-500 animate-pulse' },
  curated: { label: 'Curated', color: 'text-amber-400', dot: 'bg-amber-500' },
  applying: { label: 'Applying', color: 'text-blue-400', dot: 'bg-blue-500' },
  closed: { label: 'Closed', color: 'text-zinc-500', dot: 'bg-zinc-600' },
}

const nextAction: Record<CampaignStatus, { status: CampaignStatus; label: string; icon: typeof Play } | null> = {
  idle: { status: 'hunting', label: 'Start Hunting', icon: Play },
  hunting: { status: 'curated', label: 'Stop & Curate', icon: Square },
  curated: { status: 'applying', label: 'Start Applying', icon: Play },
  applying: { status: 'closed', label: 'Close', icon: CheckCircle2 },
  closed: null,
}

const CITY_OPTIONS = [
  'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 'Nantes', 'Strasbourg', 'Nice',
  'London', 'Manchester', 'Edinburgh', 'Birmingham',
  'Berlin', 'Munich', 'Hamburg', 'Frankfurt',
  'Amsterdam', 'Rotterdam', 'The Hague',
  'Barcelona', 'Madrid', 'Valencia',
  'Lisbon', 'Porto',
  'Brussels', 'Antwerp',
  'Zurich', 'Geneva', 'Basel',
  'Milan', 'Rome', 'Turin',
  'Dublin',
  'Vienna',
  'Copenhagen',
  'Stockholm',
  'Oslo',
  'Helsinki',
  'Warsaw', 'Krakow',
  'Prague',
  'Budapest',
  'Montreal', 'Toronto', 'Vancouver',
  'New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Austin', 'Seattle', 'Miami',
  'Sydney', 'Melbourne',
  'Singapore',
  'Tokyo',
].map(c => ({ value: c, label: c }))

const COUNTRIES = [
  'France', 'United Kingdom', 'Germany', 'Netherlands', 'Spain', 'Portugal',
  'Belgium', 'Switzerland', 'Italy', 'Ireland', 'Austria', 'Denmark',
  'Sweden', 'Norway', 'Finland', 'Poland', 'Czech Republic', 'Hungary',
  'Canada', 'United States', 'Australia', 'Singapore', 'Japan',
]

const REMOTE_OPTIONS: { value: RemotePreference; label: string }[] = [
  { value: 'onsite', label: 'Onsite' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
  { value: 'any', label: 'Any' },
]

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'any', label: 'Any' },
]

const POSTED_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Any time' },
  { value: '1', label: 'Today' },
  { value: '3', label: '3 days' },
  { value: '7', label: 'Week' },
  { value: '14', label: '2 weeks' },
  { value: '30', label: 'Month' },
]

function PillSelector<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-all',
            value === opt.value
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white/[0.05] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-300'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function CampaignControls({ campaigns, activeCampaignId, onSelectCampaign }: CampaignControlsProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [role, setRole] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [remote, setRemote] = useState<RemotePreference>('any')
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('any')
  const [maxResults, setMaxResults] = useState(5)
  const [postedWithinDays, setPostedWithinDays] = useState<number | null>(null)

  const createMutation = useCreateCampaign()
  const statusMutation = useUpdateCampaignStatus()
  const deleteMutation = useDeleteCampaign()
  const scrapeMutation = useTriggerScrape()
  const { data: schedule } = useScrapeSchedule()

  const active = campaigns.find(c => c.id === activeCampaignId)

  const resetForm = () => {
    setRole(''); setCity(''); setCountry(''); setSalaryMin(''); setSalaryMax('')
    setRemote('any'); setExperienceLevel('any'); setMaxResults(5); setPostedWithinDays(null)
  }

  const handleCreate = () => {
    if (!role.trim() || !city.trim() || !country.trim()) return
    const name = `${role.trim()} — ${city.trim()}`
    createMutation.mutate(
      {
        name,
        role: role.trim(),
        city: city.trim(),
        country: country.trim(),
        salary_min: salaryMin ? parseInt(salaryMin) : null,
        salary_max: salaryMax ? parseInt(salaryMax) : null,
        remote,
        experience_level: experienceLevel,
        max_results: maxResults,
        posted_within_days: postedWithinDays,
      },
      {
        onSuccess: (campaign) => {
          onSelectCampaign(campaign.id)
          setShowCreate(false)
          resetForm()
        },
      }
    )
  }

  return (
    <div className="space-y-3">
      {/* Campaign selector + create */}
      <div className="flex items-center gap-2">
        <Select
          value={activeCampaignId ? String(activeCampaignId) : ''}
          onValueChange={v => onSelectCampaign(parseInt(v))}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select campaign..." />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showCreate ? 'default' : 'outline'}
          size="icon"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? <X size={16} /> : <Plus size={16} />}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="space-y-4 rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent p-4">
          <h3 className="text-sm font-semibold text-zinc-200">New Campaign</h3>

          {/* Role */}
          <div>
            <Label className="mb-1.5 text-xs text-zinc-400">Role</Label>
            <Input
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="e.g. Frontend Developer"
            />
          </div>

          {/* City + Country */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 text-xs text-zinc-400">City</Label>
              <Combobox
                options={CITY_OPTIONS}
                value={city}
                onChange={setCity}
                placeholder="Select city..."
                searchPlaceholder="Search cities..."
                creatable
              />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-zinc-400">Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Salary range */}
          <div>
            <Label className="mb-1.5 text-xs text-zinc-400">Salary range (EUR/year)</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                value={salaryMin}
                onChange={e => setSalaryMin(e.target.value)}
                placeholder="Min"
              />
              <Input
                type="number"
                value={salaryMax}
                onChange={e => setSalaryMax(e.target.value)}
                placeholder="Max"
              />
            </div>
          </div>

          {/* Work style */}
          <div>
            <Label className="mb-1.5 text-xs text-zinc-400">Work style</Label>
            <PillSelector options={REMOTE_OPTIONS} value={remote} onChange={setRemote} />
          </div>

          {/* Experience */}
          <div>
            <Label className="mb-1.5 text-xs text-zinc-400">Experience level</Label>
            <PillSelector options={EXPERIENCE_OPTIONS} value={experienceLevel} onChange={setExperienceLevel} />
          </div>

          {/* Posted within */}
          <div>
            <Label className="mb-1.5 text-xs text-zinc-400">Posted within</Label>
            <Select
              value={postedWithinDays !== null ? String(postedWithinDays) : ''}
              onValueChange={v => setPostedWithinDays(v ? parseInt(v) : null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any time" />
              </SelectTrigger>
              <SelectContent>
                {POSTED_OPTIONS.map(opt => (
                  <SelectItem key={opt.value || 'any'} value={opt.value || 'any'}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Max results */}
          <div>
            <Label className="mb-1.5 text-xs text-zinc-400">Max curated results</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={maxResults}
              onChange={e => setMaxResults(parseInt(e.target.value) || 5)}
              className="w-20"
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || !role.trim() || !city.trim() || !country.trim()}
            className="w-full"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
          </Button>
        </div>
      )}

      {/* Active campaign controls */}
      {active && (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
            <div className="flex items-center gap-2">
              <div className={cn('h-2 w-2 rounded-full', statusConfig[active.status].dot)} />
              <span className={cn('text-sm font-medium', statusConfig[active.status].color)}>
                {statusConfig[active.status].label}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="xs"
                onClick={() => scrapeMutation.mutate(active.id)}
                disabled={scrapeMutation.isPending}
              >
                {scrapeMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                Scrape Now
              </Button>
              {nextAction[active.status] && (() => {
                const action = nextAction[active.status]!
                const Icon = action.icon
                return (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => statusMutation.mutate({ id: active.id, status: action.status })}
                    disabled={statusMutation.isPending}
                  >
                    <Icon size={12} /> {action.label}
                  </Button>
                )
              })()}
              {active.status !== 'hunting' && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => { if (confirm('Delete this campaign and all its jobs?')) deleteMutation.mutate(active.id) }}
                  className="text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </div>

          {/* Schedule info — shown when hunting */}
          {active.status === 'hunting' && schedule && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/10 bg-emerald-500/5 px-3 py-1.5">
              <Clock size={12} className="text-emerald-400/70" />
              <span className="text-xs text-emerald-400/70">
                Auto-scraping at <span className="font-medium text-emerald-400">{schedule.times}</span> ({schedule.timezone})
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
