import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ListChecks, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useInstructions, useAddInstruction, useUpdateInstruction, useDeleteInstruction } from '@/hooks/useMemory'

export function MemoryInstructionsTab() {
  const [newContent, setNewContent] = useState('')

  const { data: instructions, isLoading } = useInstructions()
  const addInstruction = useAddInstruction()
  const updateInstruction = useUpdateInstruction()
  const deleteInstruction = useDeleteInstruction()

  const handleAdd = () => {
    if (!newContent.trim()) return
    addInstruction.mutate(
      newContent.trim(),
      {
        onSuccess: () => {
          setNewContent('')
          toast.success('Instruction added')
        },
        onError: () => toast.error('Failed to add instruction'),
      }
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks size={16} />
          Instructions
        </CardTitle>
        <p className="text-sm text-zinc-500">
          Rules the AI always follows. Say &quot;remember to always X&quot; or &quot;never do Y&quot; in chat, or add them here.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Add an instruction..."
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button size="sm" onClick={handleAdd} disabled={!newContent.trim() || addInstruction.isPending}>
            <Plus size={14} />
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto space-y-2">
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : !instructions?.length ? (
            <p className="text-sm text-zinc-500">No instructions yet.</p>
          ) : (
            instructions.map((inst) => (
              <div
                key={inst.id}
                className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3"
              >
                <button
                  type="button"
                  onClick={() => updateInstruction.mutate(
                    { id: inst.id, active: !inst.active },
                    {
                      onError: () => toast.error('Failed to update instruction'),
                    }
                  )}
                  className="shrink-0"
                >
                  {inst.active ? (
                    <ToggleRight size={20} className="text-emerald-400" />
                  ) : (
                    <ToggleLeft size={20} className="text-zinc-600" />
                  )}
                </button>
                <p
                  className={`flex-1 min-w-0 text-sm ${
                    inst.active ? 'text-zinc-300' : 'text-zinc-600 line-through'
                  }`}
                >
                  {inst.content}
                </p>
                <Badge variant="default" className="shrink-0 text-[10px]">
                  {inst.source}
                </Badge>
                <span className="shrink-0 text-[10px] text-zinc-600">
                  {new Date(inst.created_at).toLocaleDateString()}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-zinc-500 hover:text-red-400"
                  onClick={() => deleteInstruction.mutate(inst.id, {
                    onSuccess: () => toast.success('Instruction deleted'),
                    onError: () => toast.error('Failed to delete instruction'),
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
