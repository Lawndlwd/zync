import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Shield, ShieldOff, Plus, Trash2, Eye, EyeOff, Copy, Pencil, Check, X, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  getVaultStatus, listSecrets, setSecret, deleteSecret, revealSecret,
  type SecretMeta,
} from '@/services/secrets'

const VAULT_CATEGORIES = ['all', 'general', 'jira', 'channel', 'provider', 'oauth', 'gmail'] as const

export function VaultPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)

  const [newName, setNewName] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newCategory, setNewCategory] = useState('general')

  const [revealDialog, setRevealDialog] = useState<string | null>(null)
  const [revealKey, setRevealKey] = useState('')
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, { value: string; timer: ReturnType<typeof setTimeout> }>>({})

  const [editingSecret, setEditingSecret] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editCategory, setEditCategory] = useState('')

  const status = useQuery({ queryKey: ['vault-status'], queryFn: getVaultStatus })
  const secrets = useQuery({
    queryKey: ['secrets'],
    queryFn: () => listSecrets(),
    enabled: status.data?.available === true,
  })

  const addMutation = useMutation({
    mutationFn: () => setSecret(newName, newValue, newCategory),
    onSuccess: () => {
      toast.success(`Secret "${newName}" saved`)
      setNewName('')
      setNewValue('')
      setNewCategory('general')
      setShowAddForm(false)
      queryClient.invalidateQueries({ queryKey: ['secrets'] })
    },
    onError: () => toast.error('Failed to save secret'),
  })

  const editMutation = useMutation({
    mutationFn: ({ name, value, category }: { name: string; value: string; category: string }) =>
      setSecret(name, value, category),
    onSuccess: (_, { name }) => {
      toast.success(`Secret "${name}" updated`)
      setEditingSecret(null)
      queryClient.invalidateQueries({ queryKey: ['secrets'] })
    },
    onError: () => toast.error('Failed to update secret'),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteSecret(name),
    onSuccess: (_, name) => {
      toast.success(`Secret "${name}" deleted`)
      queryClient.invalidateQueries({ queryKey: ['secrets'] })
    },
    onError: () => toast.error('Failed to delete secret'),
  })

  useEffect(() => {
    return () => {
      Object.values(revealedSecrets).forEach(({ timer }) => clearTimeout(timer))
    }
  }, [revealedSecrets])

  const handleReveal = async (name: string) => {
    try {
      const value = await revealSecret(name, revealKey)
      setRevealDialog(null)
      setRevealKey('')

      const timer = setTimeout(() => {
        setRevealedSecrets((prev) => {
          const next = { ...prev }
          delete next[name]
          return next
        })
      }, 30_000)

      setRevealedSecrets((prev) => {
        if (prev[name]) clearTimeout(prev[name].timer)
        return { ...prev, [name]: { value, timer } }
      })
    } catch (err: any) {
      toast.error(err.message || 'Failed to reveal secret')
    }
  }

  const handleHide = (name: string) => {
    setRevealedSecrets((prev) => {
      if (prev[name]) clearTimeout(prev[name].timer)
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const handleCopy = async (name: string) => {
    const revealed = revealedSecrets[name]
    if (revealed) {
      await navigator.clipboard.writeText(revealed.value)
      toast.success('Copied to clipboard')
      return
    }
    setRevealDialog(name)
  }

  const handleStartEdit = (secret: SecretMeta) => {
    setEditingSecret(secret.name)
    setEditValue('')
    setEditCategory(secret.category)
  }

  const handleDelete = (name: string) => {
    if (!window.confirm(`Delete secret "${name}"?`)) return
    deleteMutation.mutate(name)
  }

  const available = status.data?.available === true
  const allSecrets = secrets.data ?? []
  const filtered = allSecrets.filter((s) => {
    const matchesCategory = activeCategory === 'all' || s.category === activeCategory
    const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  if (!available) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <ShieldOff size={48} className="text-zinc-600" />
        <h1 className="text-2xl font-bold text-zinc-100">Vault Not Configured</h1>
        <p className="text-zinc-500 text-center max-w-md">
          Set <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">SECRET_KEY</code> in
          your server <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">.env</code> file
          to enable the encrypted vault.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={28} className="text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Vault</h1>
            <p className="text-sm text-zinc-500">
              {allSecrets.length} secret{allSecrets.length !== 1 ? 's' : ''} stored
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus size={16} className="mr-2" />
          Add Secret
        </Button>
      </div>

      {showAddForm && (
        <div className="mb-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="SECRET_NAME"
                className="h-9 font-mono text-sm"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Value</label>
              <Input
                type="password"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="secret value"
                className="h-9 text-sm"
              />
            </div>
            <div className="w-[140px]">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="h-9 w-full rounded-md border border-zinc-700/50 bg-zinc-800/50 px-2 text-sm text-zinc-100"
              >
                {VAULT_CATEGORIES.filter((c) => c !== 'all').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => addMutation.mutate()}
                disabled={addMutation.isPending || !newName.trim() || !newValue.trim()}
              >
                {addMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search secrets..."
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {VAULT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full capitalize transition-colors',
                activeCategory === cat
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-12 text-center">
          <Shield size={48} className="mx-auto mb-4 text-zinc-700" />
          <p className="text-zinc-500">
            {allSecrets.length === 0 ? 'No secrets stored yet.' : 'No secrets match your filter.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_120px_160px] gap-4 px-5 py-3 border-b border-white/[0.06] text-xs font-medium uppercase tracking-wider text-zinc-500">
            <span>Name</span>
            <span>Category</span>
            <span>Updated</span>
            <span className="text-right">Actions</span>
          </div>

          {filtered.map((secret) => {
            const isRevealed = !!revealedSecrets[secret.name]
            const isEditing = editingSecret === secret.name

            return (
              <div
                key={secret.name}
                className="grid grid-cols-[1fr_120px_120px_160px] gap-4 items-center px-5 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <div className="min-w-0">
                  <span className="font-mono text-sm text-zinc-100 truncate block">{secret.name}</span>
                  {isRevealed && (
                    <span className="font-mono text-xs text-emerald-400 truncate block mt-1">
                      {revealedSecrets[secret.name].value}
                    </span>
                  )}
                  {isEditing && (
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="password"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="new value (leave empty to keep)"
                        className="h-7 text-xs flex-1"
                      />
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="h-7 rounded-md border border-zinc-700/50 bg-zinc-800/50 px-1.5 text-xs text-zinc-100"
                      >
                        {VAULT_CATEGORIES.filter((c) => c !== 'all').map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0"
                        disabled={editMutation.isPending}
                        onClick={() => {
                          if (!editValue.trim()) {
                            toast.error('Enter the secret value to update')
                            return
                          }
                          editMutation.mutate({ name: secret.name, value: editValue, category: editCategory })
                        }}
                      >
                        <Check size={14} className="text-emerald-400" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={() => setEditingSecret(null)}
                      >
                        <X size={14} className="text-zinc-500" />
                      </Button>
                    </div>
                  )}
                </div>

                <Badge variant="default" className="w-fit text-xs capitalize">
                  {secret.category}
                </Badge>

                <span className="text-xs text-zinc-500">
                  {new Date(secret.updatedAt).toLocaleDateString()}
                </span>

                <div className="flex items-center justify-end gap-1">
                  {isRevealed ? (
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                      onClick={() => handleHide(secret.name)}
                      title="Hide"
                    >
                      <EyeOff size={14} />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                      onClick={() => setRevealDialog(secret.name)}
                      title="Reveal"
                    >
                      <Eye size={14} />
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                    onClick={() => handleCopy(secret.name)}
                    title="Copy"
                  >
                    <Copy size={14} />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                    onClick={() => handleStartEdit(secret)}
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400"
                    onClick={() => handleDelete(secret.name)}
                    disabled={deleteMutation.isPending}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {revealDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-white/[0.08] bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100 mb-1">Reveal Secret</h3>
            <p className="text-sm text-zinc-500 mb-4">
              Enter your <code className="rounded bg-zinc-800 px-1 text-zinc-400">SECRET_KEY</code> to
              decrypt <span className="font-mono text-zinc-300">{revealDialog}</span>
            </p>
            <Input
              type="password"
              value={revealKey}
              onChange={(e) => setRevealKey(e.target.value)}
              placeholder="SECRET_KEY"
              className="mb-4 h-9 font-mono text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && revealKey.trim()) handleReveal(revealDialog)
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost" size="sm"
                onClick={() => { setRevealDialog(null); setRevealKey('') }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleReveal(revealDialog)}
                disabled={!revealKey.trim()}
              >
                <Eye size={14} className="mr-2" />
                Reveal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
