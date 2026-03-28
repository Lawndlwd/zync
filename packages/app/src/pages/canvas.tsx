import { LiveCanvas } from '@/components/canvas/LiveCanvas'

export function CanvasPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-display font-bold text-foreground">Canvas</h1>
        <p className="text-sm text-muted-foreground">Live AI-rendered content via WebSocket</p>
      </div>
      <div className="flex-1 rounded-xl border border-border bg-secondary overflow-hidden">
        <LiveCanvas />
      </div>
    </div>
  )
}
