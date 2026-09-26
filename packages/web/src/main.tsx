import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { BoardsList } from './boards/BoardsList'
import { BoardView } from './boards/BoardView'
import { DialogProvider } from './components/Dialog'
import { FileView } from './FileView'
import { Home } from './Home'
import { JobsView } from './JobsView'
import { Layout } from './Layout'
import { Overview } from './Overview'
import { PeopleView } from './PeopleView'
import { SettingsView } from './SettingsView'
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
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<Overview />} />
              <Route path="files/*" element={<FileView />} />
              <Route path="boards" element={<BoardsList />} />
              <Route path="boards/*" element={<BoardView />} />
              <Route path="people" element={<PeopleView />} />
              <Route path="jobs" element={<JobsView />} />
              <Route path="settings" element={<SettingsView />} />
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
