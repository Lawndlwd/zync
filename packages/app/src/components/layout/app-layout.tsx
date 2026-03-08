import { Outlet } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { useOpenCodeSSE } from '@/hooks/useOpenCodeSSE'
import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'

const ChatPanel = lazy(() => import('@/components/ai-agent/chat-panel').then(m => ({ default: m.ChatPanel })))
const DynamicIsland = lazy(() => import('@/components/voice/DynamicIsland').then(m => ({ default: m.DynamicIsland })))

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 size={24} className="animate-spin text-zinc-600" />
    </div>
  )
}

export function AppLayout() {
  useOpenCodeSSE()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="relative flex-1 overflow-hidden flex flex-col">
        {/* Gradient orbs for glass effect visibility */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] h-[500px] w-[600px] rounded-full bg-indigo-500/[0.07] blur-[120px]" />
          <div className="absolute top-[30%] -right-[5%] h-[500px] w-[500px] rounded-full bg-emerald-500/[0.07] blur-[120px]" />
          <div className="absolute -bottom-[10%] left-[20%] h-[500px] w-[500px] rounded-full bg-violet-500/[0.06] blur-[120px]" />
        </div>
        <div className="relative px-8 pt-8 xl:px-10 flex flex-col flex-1 min-h-0 overflow-y-auto">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <Suspense>
        <ChatPanel />
        <DynamicIsland />
      </Suspense>
    </div>
  )
}
