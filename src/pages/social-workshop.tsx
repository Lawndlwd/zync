import { useState, useEffect } from 'react'
import { Lightbulb } from 'lucide-react'
import { WorkshopBoard } from '@/components/social/workshop-board'
import { OpenCodeChat } from '@/components/opencode/OpenCodeChat'
import { WorkshopBoardSelector } from '@/components/social/workshop-board-selector'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import * as socialService from '@/services/social'
import toast from 'react-hot-toast'

export function SocialWorkshop() {
  const [boards, setBoards] = useState<Awaited<ReturnType<typeof socialService.getWorkshopBoards>>>([])
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null)
  const [boardsLoading, setBoardsLoading] = useState(true)
  const [workshopRefreshKey] = useState(0)

  useEffect(() => {
    setBoardsLoading(true)
    socialService.getWorkshopBoards()
      .then((b) => {
        setBoards(b)
        if (b.length > 0 && !selectedBoardId) setSelectedBoardId(b[0].id)
      })
      .catch(() => {})
      .finally(() => setBoardsLoading(false))
  }, [])

  const handleCreateBoard = async (name: string) => {
    try {
      const result = await socialService.createWorkshopBoard(name)
      const newBoard = { id: result.id, name, platform: 'general', created_at: new Date().toISOString() }
      setBoards((prev) => [newBoard, ...prev])
      setSelectedBoardId(result.id)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create board')
    }
  }

  const handleDeleteBoard = async (id: number) => {
    try {
      await socialService.deleteWorkshopBoard(id)
      setBoards((prev) => prev.filter((b) => b.id !== id))
      if (selectedBoardId === id) {
        const remaining = boards.filter((b) => b.id !== id)
        setSelectedBoardId(remaining.length > 0 ? remaining[0].id : null)
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete board')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h2 className="text-lg font-semibold text-zinc-100">Workshop</h2>
        <WorkshopBoardSelector
          boards={boards}
          selectedId={selectedBoardId}
          onSelect={setSelectedBoardId}
          onCreate={handleCreateBoard}
          onDelete={handleDeleteBoard}
          isLoading={boardsLoading}
        />
      </div>

      {selectedBoardId ? (
        <div className="flex-1 min-h-0">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize="70%" minSize="30%">
              <div className="h-full pr-2">
                <WorkshopBoard boardId={selectedBoardId} refreshKey={workshopRefreshKey} />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="30%" minSize="300px" maxSize="50%">
              <div className="h-full pl-2 rounded-xl border border-white/[0.06] bg-white/[0.02] flex flex-col overflow-hidden">
                <OpenCodeChat />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
          <Lightbulb size={32} className="mb-3 text-indigo-400/30" />
          <p className="text-sm mb-1">No board selected</p>
          <p className="text-xs">Create a new board to start brainstorming</p>
        </div>
      )}
    </div>
  )
}
