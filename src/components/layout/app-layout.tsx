import { Outlet } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { useOpenCodeSSE } from '@/hooks/useOpenCodeSSE'
import { lazy, Suspense } from 'react'

const ChatPanel = lazy(() => import('@/components/ai-agent/chat-panel').then(m => ({ default: m.ChatPanel })))
const DynamicIsland = lazy(() => import('@/components/voice/DynamicIsland').then(m => ({ default: m.DynamicIsland })))

export function AppLayout() {
  useOpenCodeSSE()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="relative flex-1 overflow-y-auto">
        {/* Gradient orbs for glass effect visibility */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] h-[500px] w-[600px] rounded-full bg-indigo-500/[0.07] blur-[120px]" />
          <div className="absolute top-[30%] -right-[5%] h-[500px] w-[500px] rounded-full bg-emerald-500/[0.07] blur-[120px]" />
          <div className="absolute -bottom-[10%] left-[20%] h-[500px] w-[500px] rounded-full bg-violet-500/[0.06] blur-[120px]" />
        </div>
        <div className="relative px-8 py-8 xl:px-10 flex flex-col min-h-full">
          <Outlet />
        </div>
      </main>
      <Suspense>
        <ChatPanel />
        <DynamicIsland />
      </Suspense>
    </div>
  )
}
