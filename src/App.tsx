import { Routes, Route, Outlet, useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { lazy, Suspense, useEffect, useState } from 'react'

const DashboardPage = lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })))
const JiraPage = lazy(() => import('@/pages/jira').then(m => ({ default: m.JiraPage })))
const TasksPage = lazy(() => import('@/pages/tasks').then(m => ({ default: m.TasksPage })))
const ChatPage = lazy(() => import('@/pages/opencode').then(m => ({ default: m.OpenCodePage })))
const SettingsPage = lazy(() => import('@/pages/settings').then(m => ({ default: m.SettingsPage })))
const ProductivityPage = lazy(() => import('@/pages/productivity').then(m => ({ default: m.ProductivityPage })))
const ActivityPage = lazy(() => import('@/pages/activity').then(m => ({ default: m.ActivityPage })))
const GitLabPage = lazy(() => import('@/pages/gitlab').then(m => ({ default: m.GitLabPage })))
const GitLabMRPage = lazy(() => import('@/pages/gitlab-mr').then(m => ({ default: m.GitLabMRPage })))
const GitHubPage = lazy(() => import('@/pages/github').then(m => ({ default: m.GitHubPage })))
const GitHubPRPage = lazy(() => import('@/pages/github-pr').then(m => ({ default: m.GitHubPRPage })))
const DocumentsPage = lazy(() => import('@/pages/documents').then(m => ({ default: m.DocumentsPage })))
const CanvasPage = lazy(() => import('@/pages/canvas').then(m => ({ default: m.CanvasPage })))
const SetupPage = lazy(() => import('@/pages/setup').then(m => ({ default: m.SetupPage })))
const JobsPage = lazy(() => import('@/pages/jobs').then(m => ({ default: m.JobsPage })))
const ProfilePage = lazy(() => import('@/pages/profile').then(m => ({ default: m.ProfilePage })))
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
        const { updateJira, updateGitlab, updateGithub, updateMessages, settings } = useSettingsStore.getState()
        updateJira({
          baseUrl: env.jira.baseUrl || settings.jira.baseUrl,
          email: env.jira.email || settings.jira.email,
          projectKey: env.jira.projectKey || settings.jira.projectKey,
        })
        if (env.gitlab?.baseUrl) {
          updateGitlab({ baseUrl: env.gitlab.baseUrl })
        }
        if (env.github?.baseUrl) {
          updateGithub({ baseUrl: env.github.baseUrl })
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
            <Route path="/jira" element={<JiraPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:projectName" element={<TasksPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/productivity" element={<ProductivityPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/gitlab" element={<GitLabPage />} />
            <Route path="/gitlab/mr/:projectId/:iid" element={<GitLabMRPage />} />
            <Route path="/github" element={<GitHubPage />} />
            <Route path="/github/pr/:owner/:repo/:number" element={<GitHubPRPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/:folder" element={<DocumentsPage />} />
            <Route path="/documents/:folder/:doc" element={<DocumentsPage />} />
            <Route path="/canvas" element={<CanvasPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
