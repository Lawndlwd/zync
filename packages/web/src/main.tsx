import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { DialogProvider } from './components/Dialog'
import { Home } from './Home'
import { Layout } from './Layout'
import { workspaceViews } from './routes'
import './zync.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DialogProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
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
