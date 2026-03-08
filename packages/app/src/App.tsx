import { Routes, Route, Outlet, useNavigate, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { lazy, Suspense, useEffect, useState } from 'react'

const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })))
const TasksPage = lazy(() => import('@/pages/tasks').then(m => ({ default: m.TasksPage })))
const ChatPage = lazy(() => import('@/pages/opencode').then(m => ({ default: m.OpenCodePage })))
const SettingsPage = lazy(() => import('@/pages/settings').then(m => ({ default: m.SettingsPage })))
const ProductivityPage = lazy(() => import('@/pages/productivity').then(m => ({ default: m.ProductivityPage })))
const ActivityPage = lazy(() => import('@/pages/activity').then(m => ({ default: m.ActivityPage })))
const DocumentsPage = lazy(() => import('@/pages/documents').then(m => ({ default: m.DocumentsPage })))
const CanvasPage = lazy(() => import('@/pages/canvas').then(m => ({ default: m.CanvasPage })))
const SetupPage = lazy(() => import('@/pages/setup').then(m => ({ default: m.SetupPage })))
const JobsPage = lazy(() => import('@/pages/jobs').then(m => ({ default: m.JobsPage })))
const ProfilePage = lazy(() => import('@/pages/profile').then(m => ({ default: m.ProfilePage })))
const SocialLayout = lazy(() => import('@/components/social/social-layout').then(m => ({ default: m.SocialLayout })))
const SocialDashboard = lazy(() => import('@/pages/social-dashboard').then(m => ({ default: m.SocialDashboard })))
const SocialTrending = lazy(() => import('@/pages/social-trending').then(m => ({ default: m.SocialTrending })))
const SocialCalendarTab = lazy(() => import('@/pages/social-calendar-tab').then(m => ({ default: m.SocialCalendarTab })))
const SocialWorkshop = lazy(() => import('@/pages/social-workshop').then(m => ({ default: m.SocialWorkshop })))
const SocialCreate = lazy(() => import('@/pages/social-create').then(m => ({ default: m.SocialCreate })))
const SocialInbox = lazy(() => import('@/pages/social-inbox').then(m => ({ default: m.SocialInbox })))
const SocialSettingsTab = lazy(() => import('@/pages/social-settings-tab').then(m => ({ default: m.SocialSettingsTab })))
import { useSettingsStore } from '@/store/settings'
import { fetchServerSettings } from '@/services/settings'
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
        const { updateJira, updateGitlab, updateGithub, updateMessages, settings } = useSettingsStore.getState()
        updateJira({
          baseUrl: env.jira.baseUrl || settings.jira.baseUrl,
          email: env.jira.email || settings.jira.email,
          projectKey: env.jira.projectKey || settings.jira.projectKey,
        })
        if (env.gitlab?.baseUrl || env.gitlab?.pat) {
          updateGitlab({
            baseUrl: env.gitlab.baseUrl || settings.gitlab.baseUrl,
            pat: env.gitlab.pat || settings.gitlab.pat,
          })
        }
        if (env.github?.baseUrl || env.github?.pat) {
          updateGithub({
            baseUrl: env.github.baseUrl || settings.github.baseUrl,
            pat: env.github.pat || settings.github.pat,
          })
        }
        if (env.messages.customEndpoint) {
          updateMessages({ customEndpoint: env.messages.customEndpoint })
        }
      })
      .catch(() => {/* backend not running */})
  }, [])

  return (
    <Suspense>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route element={<SetupGuard />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:projectName" element={<TasksPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/productivity" element={<ProductivityPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/*" element={<DocumentsPage />} />
            <Route path="/canvas" element={<CanvasPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/social" element={<SocialLayout />}>
              <Route index element={<Navigate to="/social/dashboard" replace />} />
              <Route path="dashboard" element={<SocialDashboard />} />
              <Route path="trending" element={<SocialTrending />} />
              <Route path="calendar" element={<SocialCalendarTab />} />
              <Route path="workshop" element={<SocialWorkshop />} />
              <Route path="create" element={<SocialCreate />} />
              <Route path="create/:id" element={<SocialCreate />} />
              <Route path="inbox" element={<SocialInbox />} />
              <Route path="settings" element={<SocialSettingsTab />} />
            </Route>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
