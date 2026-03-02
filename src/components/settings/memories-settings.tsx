import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Brain, Search, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useBotMemories, useCreateMemory, useDeleteMemory } from '@/hooks/useBot'

export function MemoriesSettingsCard() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const { data: memories, isLoading } = useBotMemories(debouncedSearch || undefined)
  const createMemory = useCreateMemory()
  const deleteMemory = useDeleteMemory()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleAdd = () => {
    if (!newContent.trim()) return
    createMemory.mutate(
      { content: newContent.trim(), category: newCategory.trim() || undefined },
      {
        onSuccess: () => {
          setNewContent('')
          setNewCategory('')
          toast.success('Memory added')
        },
        onError: () => toast.error('Failed to add memory'),
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain size={16} />
          Agent Memories
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memories..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Input
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Memory content..."
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Category"
            className="w-32"
          />
          <Button size="sm" onClick={handleAdd} disabled={!newContent.trim() || createMemory.isPending}>
            <Plus size={14} />
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : !memories?.length ? (
            <p className="text-sm text-zinc-500">No memories found.</p>
          ) : (
            memories.map((m) => (
              <div key={m.id} className="flex items-start gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300">{m.content}</p>
                  <Badge variant="default" className="mt-1 text-[10px]">{m.category}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-zinc-500 hover:text-red-400"
                  onClick={() => deleteMemory.mutate(m.id, {
                    onSuccess: () => toast.success('Memory deleted'),
                    onError: () => toast.error('Failed to delete'),
                  })}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
