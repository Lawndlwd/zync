import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { ApiError } from './api'
import { LoginPage } from './auth/LoginPage'
import { DialogProvider } from './components/Dialog'
import { Home } from './home/Home'
import { workspaceViews } from './routes'
import { Layout } from './shell/Layout'

// oxlint-disable-next-line import/no-unassigned-import -- CSS import
import './zync.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // File changes arrive as live events (Layout), which invalidate what they touch.
      staleTime: 30_000,
      // A 4xx won't change on retry; a network error or a 5xx gets one more try.
      retry: (failures, err) => failures < 1 && !(err instanceof ApiError && err.status < 500),
    },
  },
})

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DialogProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/w/:ws" element={<Layout />}>
              {workspaceViews()}
              {/* Chat is rendered by Layout (always mounted) so its state survives navigation. */}
              <Route path="chat" element={null} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </DialogProvider>
    </QueryClientProvider>
  </StrictMode>,
)
