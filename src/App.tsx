import { Routes, Route, Outlet, useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { lazy, Suspense, useEffect, useState } from 'react'

const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })))
const JiraPage = lazy(() => import('@/pages/jira').then(m => ({ default: m.JiraPage })))
const TasksPage = lazy(() => import('@/pages/tasks').then(m => ({ default: m.TasksPage })))
const InboxPage = lazy(() => import('@/pages/inbox').then(m => ({ default: m.InboxPage })))
const JournalPage = lazy(() => import('@/pages/journal').then(m => ({ default: m.JournalPage })))
const SettingsPage = lazy(() => import('@/pages/settings').then(m => ({ default: m.SettingsPage })))
const ProductivityPage = lazy(() => import('@/pages/productivity').then(m => ({ default: m.ProductivityPage })))
const ActivityPage = lazy(() => import('@/pages/activity').then(m => ({ default: m.ActivityPage })))
const GitLabPage = lazy(() => import('@/pages/gitlab').then(m => ({ default: m.GitLabPage })))
const GitLabMRPage = lazy(() => import('@/pages/gitlab-mr').then(m => ({ default: m.GitLabMRPage })))
const DocumentsPage = lazy(() => import('@/pages/documents').then(m => ({ default: m.DocumentsPage })))
const OpenCodePage = lazy(() => import('@/pages/opencode').then(m => ({ default: m.OpenCodePage })))
const CanvasPage = lazy(() => import('@/pages/canvas').then(m => ({ default: m.CanvasPage })))
const SetupPage = lazy(() => import('@/pages/setup').then(m => ({ default: m.SetupPage })))
import { useSettingsStore } from '@/store/settings'
import { fetchServerSettings } from '@/services/jira'
import { getSetupStatus } from '@/services/setup'

function SetupGuard() {
  const [checked, setChecked] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getSetupStatus()
      .then((status) => {
        if (!status.initialized) {
          setNeedsSetup(true)
        }
        setChecked(true)
      })
      .catch(() => {
        // Backend unavailable — skip guard
        setChecked(true)
      })
  }, [])

  useEffect(() => {
    if (checked && needsSetup) {
      navigate('/setup', { replace: true })
    }
  }, [checked, needsSetup, navigate])

  if (!checked) return null
  if (needsSetup) return null

  return <Outlet />
}

export function App() {
  // Auto-sync non-secret env values into settings store on startup
  useEffect(() => {
    fetchServerSettings()
      .then((env) => {
        const { updateJira, updateGitlab, updateMessages, settings } = useSettingsStore.getState()
        updateJira({
          baseUrl: env.jira.baseUrl || settings.jira.baseUrl,
          email: env.jira.email || settings.jira.email,
          projectKey: env.jira.projectKey || settings.jira.projectKey,
        })
        if (env.gitlab?.baseUrl) {
          updateGitlab({ baseUrl: env.gitlab.baseUrl })
        }
        if (env.messages.customEndpoint) {
          updateMessages({ customEndpoint: env.messages.customEndpoint })
        }
      })
      .catch(() => {/* backend not running */})
  }, [])

  // Cmd+J to open journal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        window.location.href = '/journal'
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <Suspense>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route element={<SetupGuard />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/jira" element={<JiraPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:projectName" element={<TasksPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/productivity" element={<ProductivityPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/gitlab" element={<GitLabPage />} />
            <Route path="/gitlab/mr/:projectId/:iid" element={<GitLabMRPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/:folder" element={<DocumentsPage />} />
            <Route path="/documents/:folder/:doc" element={<DocumentsPage />} />
            <Route path="/opencode" element={<OpenCodePage />} />
            <Route path="/canvas" element={<CanvasPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
