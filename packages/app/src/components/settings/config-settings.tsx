import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, Settings, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { deleteConfig, listConfig, setConfig } from '@/services/config'

const CONFIG_CATEGORIES = ['general', 'server', 'briefing', 'llm', 'voice', 'channels'] as const

export function ConfigSettingsCard() {
  const queryClient = useQueryClient()
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [category, setCategory] = useState<string>('general')
  const [open, setOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const settings = useQuery({
    queryKey: ['config-settings'],
    queryFn: () => listConfig(),
  })

  const addMutation = useMutation({
    mutationFn: () => setConfig(key, value, category),
    onSuccess: () => {
      toast.success(`Setting "${key}" saved`)
      setKey('')
      setValue('')
      setCategory('general')
      queryClient.invalidateQueries({ queryKey: ['config-settings'] })
    },
    onError: () => toast.error('Failed to save setting'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ key, value, category }: { key: string; value: string; category: string }) =>
      setConfig(key, value, category),
    onSuccess: (_data, { key }) => {
      toast.success(`Setting "${key}" updated`)
      setEditingKey(null)
      setEditValue('')
      queryClient.invalidateQueries({ queryKey: ['config-settings'] })
    },
    onError: () => toast.error('Failed to update setting'),
  })

  const deleteMutation = useMutation({
    mutationFn: (settingKey: string) => deleteConfig(settingKey),
    onSuccess: (_data, settingKey) => {
      toast.success(`Setting "${settingKey}" deleted`)
      queryClient.invalidateQueries({ queryKey: ['config-settings'] })
    },
    onError: () => toast.error('Failed to delete setting'),
  })

  const handleAdd = () => {
    if (!key.trim() || !value.trim()) return
    addMutation.mutate()
  }

  const handleDelete = (settingKey: string) => {
    if (!window.confirm(`Delete setting "${settingKey}"?`)) return
    deleteMutation.mutate(settingKey)
  }

  const startEditing = (settingKey: string, currentValue: string) => {
    setEditingKey(settingKey)
    setEditValue(currentValue)
  }

  const saveEdit = (settingKey: string, settingCategory: string) => {
    if (!editValue.trim()) return
    updateMutation.mutate({ key: settingKey, value: editValue, category: settingCategory })
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setEditValue('')
  }

  const grouped = (settings.data ?? []).reduce<Record<string, typeof settings.data>>((acc, s) => {
    const cat = s.category || 'general'
    ;(acc[cat] ??= []).push(s)
    return acc
  }, {})

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Settings size={18} className="text-blue-400" />
          Configuration
          <Badge variant="default" className="ml-2 text-xs">
            {settings.data?.length ?? 0} setting{(settings.data?.length ?? 0) !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {open ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <label className="mb-1 block text-xs text-muted-foreground">Key</label>
                <Input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="setting.key"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="mb-1 block text-xs text-muted-foreground">Value</label>
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="value"
                  className="h-8 text-sm"
                />
              </div>
              <div className="w-[130px]">
                <label className="mb-1 block text-xs text-muted-foreground">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-secondary px-2 text-sm text-foreground"
                >
                  {CONFIG_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending || !key.trim() || !value.trim()}>
                <Plus size={14} className="mr-1" />
                {addMutation.isPending ? 'Saving...' : 'Add'}
              </Button>
            </div>

            {Object.keys(grouped).length === 0 ? (
              <p className="text-sm text-muted-foreground">No settings configured yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat}>
                    <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{cat}</h4>
                    <div className="space-y-1">
                      {items!.map((s) => (
                        <div
                          key={s.key}
                          className="flex items-center justify-between rounded-md bg-secondary px-3 py-1.5"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-sm font-mono text-foreground shrink-0">{s.key}</span>
                            {editingKey === s.key ? (
                              <div className="flex items-center gap-1 flex-1 min-w-0">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit(s.key, s.category)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                  onBlur={() => saveEdit(s.key, s.category)}
                                  autoFocus
                                  className="h-6 text-xs flex-1"
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-emerald-400 hover:text-emerald-300"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => saveEdit(s.key, s.category)}
                                >
                                  <Check size={12} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={cancelEdit}
                                >
                                  <X size={12} />
                                </Button>
                              </div>
                            ) : (
                              <span
                                className="text-xs text-muted-foreground truncate cursor-pointer hover:text-foreground transition-colors"
                                onClick={() => startEditing(s.key, s.value)}
                                title="Click to edit"
                              >
                                {s.value}
                                <Pencil size={10} className="inline ml-1 opacity-0 group-hover:opacity-100" />
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground shrink-0">
                              {new Date(s.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400 shrink-0 ml-2"
                            onClick={() => handleDelete(s.key)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Click header to manage configuration settings</p>
        )}
      </CardContent>
    </Card>
  )
}
