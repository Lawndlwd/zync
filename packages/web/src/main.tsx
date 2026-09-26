import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { FileView } from './FileView'
import { Home } from './Home'
import { JobsView } from './JobsView'
import { Layout } from './Layout'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/w/:ws" element={<Layout />}>
            <Route index element={<Navigate to="files" replace />} />
            <Route path="files/*" element={<FileView />} />
            <Route path="jobs" element={<JobsView />} />
            {/* Chat is rendered by Layout (always mounted) so its state survives navigation. */}
            <Route path="chat" element={null} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
