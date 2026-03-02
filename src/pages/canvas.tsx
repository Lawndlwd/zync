import { LiveCanvas } from '@/components/canvas/LiveCanvas'

export function CanvasPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-100">Canvas</h1>
        <p className="text-sm text-zinc-500">Live AI-rendered content via WebSocket</p>
      </div>
      <div className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
        <LiveCanvas />
      </div>
    </div>
  )
}
