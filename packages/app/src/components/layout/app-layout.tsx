import { Loader2 } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { AutopilotBreakerModal } from '@/components/planner/autopilot-breaker-modal'
import { useOpenCodeSSE } from '@/hooks/useOpenCodeSSE'
import { Sidebar } from './sidebar'

const ChatPanel = lazy(() => import('@/components/ai-agent/chat-panel').then((m) => ({ default: m.ChatPanel })))

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 size={24} className="animate-spin text-muted-foreground" />
    </div>
  )
}

export function AppLayout() {
  useOpenCodeSSE()

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto px-4 xl:px-10 pt-6 pb-8">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Suspense>
        <ChatPanel />
      </Suspense>
      <AutopilotBreakerModal />
    </div>
  )
}
