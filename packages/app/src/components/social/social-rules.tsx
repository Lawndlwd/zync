import { useState } from 'react'
import type { ReplyRule } from '@zync/shared/types'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SocialRulesProps {
  rules: ReplyRule[]
  isLoading: boolean
  onAdd: (rule: { platform: string; pattern: string; response_template: string }) => void
  onUpdate: (id: number, updates: Partial<ReplyRule>) => void
  onDelete: (id: number) => void
}

export function SocialRules({ rules, isLoading, onAdd, onUpdate, onDelete }: SocialRulesProps) {
  const [showForm, setShowForm] = useState(false)
  const [newPlatform, setNewPlatform] = useState('all')
  const [newPattern, setNewPattern] = useState('')
  const [newTemplate, setNewTemplate] = useState('')

  const handleAdd = () => {
    if (!newPattern.trim() || !newTemplate.trim()) return
    onAdd({ platform: newPlatform, pattern: newPattern, response_template: newTemplate })
    setNewPattern('')
    setNewTemplate('')
    setShowForm(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-300">Auto-Reply Rules</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Define patterns to auto-reply to comments. Use {'{{ai}}'} in templates for LLM expansion.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} className="mr-1" />
          Add Rule
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 mb-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Platform</label>
              <select
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200"
              >
                <option value="all">All</option>
                <option value="instagram">Instagram</option>
                <option value="x">X</option>
                <option value="youtube">YouTube</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Pattern (regex or keyword)</label>
              <input
                type="text"
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder="e.g. price|how much"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Response Template</label>
              <input
                type="text"
                value={newTemplate}
                onChange={(e) => setNewTemplate(e.target.value)}
                placeholder='e.g. Check our bio for pricing! {{ai}}'
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!newPattern.trim() || !newTemplate.trim()}>
              Save Rule
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">Loading rules...</div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <p className="text-sm">No rules configured</p>
          <p className="text-xs mt-1">Add rules to auto-reply to matching comments</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                'rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-4',
                !rule.enabled && 'opacity-50'
              )}
            >
              <button
                onClick={() => onUpdate(rule.id, { enabled: !rule.enabled })}
                className="text-zinc-400 hover:text-zinc-200"
              >
                {rule.enabled ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-zinc-500 capitalize">{rule.platform}</span>
                  <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs text-amber-400">{rule.pattern}</code>
                </div>
                <p className="text-sm text-zinc-400 truncate">{rule.response_template}</p>
              </div>
              <button onClick={() => onDelete(rule.id)} className="text-zinc-600 hover:text-rose-400">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
