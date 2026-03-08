import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield, ShieldOff, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getVaultStatus, listSecrets, setSecret, deleteSecret } from '@/services/secrets'

const VAULT_CATEGORIES = ['general', 'jira', 'channel', 'provider', 'oauth', 'gmail'] as const

export function VaultSettingsCard() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [category, setCategory] = useState<string>('general')
  const [open, setOpen] = useState(false)

  const status = useQuery({ queryKey: ['vault-status'], queryFn: getVaultStatus })
  const secrets = useQuery({
    queryKey: ['secrets'],
    queryFn: () => listSecrets(),
    enabled: status.data?.available === true,
  })

  const addMutation = useMutation({
    mutationFn: () => setSecret(name, value, category),
    onSuccess: () => {
      toast.success(`Secret "${name}" saved`)
      setName('')
      setValue('')
      setCategory('general')
      queryClient.invalidateQueries({ queryKey: ['secrets'] })
    },
    onError: () => toast.error('Failed to save secret'),
  })

  const deleteMutation = useMutation({
    mutationFn: (secretName: string) => deleteSecret(secretName),
    onSuccess: (_data, secretName) => {
      toast.success(`Secret "${secretName}" deleted`)
      queryClient.invalidateQueries({ queryKey: ['secrets'] })
    },
    onError: () => toast.error('Failed to delete secret'),
  })

  const handleAdd = () => {
    if (!name.trim() || !value.trim()) return
    addMutation.mutate()
  }

  const handleDelete = (secretName: string) => {
    if (!window.confirm(`Delete secret "${secretName}"?`)) return
    deleteMutation.mutate(secretName)
  }

  const available = status.data?.available === true
  const grouped = (secrets.data ?? []).reduce<Record<string, typeof secrets.data>>((acc, s) => {
    const key = s.category || 'general'
    ;(acc[key] ??= []).push(s)
    return acc
  }, {})

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => available && setOpen(o => !o)}>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          {available
            ? <Shield size={18} className="text-emerald-400" />
            : <ShieldOff size={18} className="text-red-400" />}
          Vault
          {available && (
            <Badge variant="default" className="ml-2 text-xs">
              {secrets.data?.length ?? 0} secret{(secrets.data?.length ?? 0) !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {!available ? (
          <p className="text-sm text-zinc-500">
            Vault not configured &mdash; set <code className="rounded bg-zinc-800 px-1 text-zinc-400">SECRET_KEY</code> in server/.env
          </p>
        ) : open ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <label className="mb-1 block text-xs text-zinc-400">Name</label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="SECRET_NAME"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="mb-1 block text-xs text-zinc-400">Value</label>
                <Input
                  type="password"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder="secret value"
                  className="h-8 text-sm"
                />
              </div>
              <div className="w-[130px]">
                <label className="mb-1 block text-xs text-zinc-400">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="h-8 w-full rounded-md border border-zinc-700/50 bg-zinc-800/50 px-2 text-sm text-zinc-100"
                >
                  {VAULT_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending || !name.trim() || !value.trim()}>
                <Plus size={14} className="mr-1" />
                {addMutation.isPending ? 'Saving...' : 'Add'}
              </Button>
            </div>

            {Object.keys(grouped).length === 0 ? (
              <p className="text-sm text-zinc-500">No secrets stored yet.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat}>
                    <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{cat}</h4>
                    <div className="space-y-1">
                      {items!.map(s => (
                        <div key={s.name} className="flex items-center justify-between rounded-md bg-zinc-800/50 px-3 py-1.5">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-zinc-100">{s.name}</span>
                            <span className="text-xs text-zinc-500">
                              {new Date(s.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-zinc-500 hover:text-red-400"
                            onClick={() => handleDelete(s.name)}
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
          <p className="text-sm text-zinc-500">Click header to manage secrets</p>
        )}
      </CardContent>
    </Card>
  )
}
