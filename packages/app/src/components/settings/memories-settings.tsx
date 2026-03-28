import { Brain, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useDeleteMemory, useMemories, useMemoryCategories } from '@/hooks/useMemory'

export function MemoriesSettingsCard() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: memories, isLoading } = useMemories(debouncedSearch || undefined, selectedCategory)
  const deleteMemory = useDeleteMemory()
  const { data: categories } = useMemoryCategories()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain size={16} />
          Learned Memories
        </CardTitle>
        <p className="text-xs text-muted-foreground">Facts and observations the AI has learned about you.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memories..."
              className="pl-9"
            />
          </div>
          <select
            value={selectedCategory ?? ''}
            onChange={(e) => setSelectedCategory(e.target.value || undefined)}
            className="bg-transparent border border-border text-foreground text-xs rounded-md px-2 py-1.5"
          >
            <option value="">All categories</option>
            {categories?.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="max-h-80 overflow-y-auto space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !memories?.length ? (
            <p className="text-sm text-muted-foreground">No memories found.</p>
          ) : (
            memories.map((m) => (
              <div key={m.id} className="flex items-start gap-2 rounded-lg border border-border bg-secondary p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{m.content}</p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <Badge variant="default" className="text-[10px]">
                      {m.category}
                    </Badge>
                    <Badge variant="default" className="text-[10px]">
                      {m.source}
                    </Badge>
                    {m.access_count > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        accessed {m.access_count} {m.access_count === 1 ? 'time' : 'times'}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-400"
                  onClick={() =>
                    deleteMemory.mutate(m.id, {
                      onSuccess: () => toast.success('Memory deleted'),
                      onError: () => toast.error('Failed to delete'),
                    })
                  }
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
