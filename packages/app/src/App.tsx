import { lazy, Suspense, useEffect, useState } from 'react'
import { Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { useThemeEffect } from '@/hooks/useTheme'

const PlannerPage = lazy(() => import('@/pages/planner').then((m) => ({ default: m.PlannerPage })))
const PageEditorPage = lazy(() => import('@/pages/page-editor').then((m) => ({ default: m.PageEditorPage })))
const TasksPage = lazy(() => import('@/pages/tasks').then((m) => ({ default: m.TasksPage })))
const ChatPage = lazy(() => import('@/pages/opencode').then((m) => ({ default: m.OpenCodePage })))
const SettingsPage = lazy(() => import('@/pages/settings').then((m) => ({ default: m.SettingsPage })))
const ProductivityPage = lazy(() => import('@/pages/productivity').then((m) => ({ default: m.ProductivityPage })))
const DocumentsPage = lazy(() => import('@/pages/documents').then((m) => ({ default: m.DocumentsPage })))
const CanvasPage = lazy(() => import('@/pages/canvas').then((m) => ({ default: m.CanvasPage })))
const SetupPage = lazy(() => import('@/pages/setup').then((m) => ({ default: m.SetupPage })))
const VaultPage = lazy(() => import('@/pages/vault').then((m) => ({ default: m.VaultPage })))

import { getSetupStatus } from '@/services/setup'

const ActivityPage = lazy(() => import('./pages/activity').then((m) => ({ default: m.ActivityPage })))
const DashboardPage = lazy(() => import('./pages/dashboard').then((m) => ({ default: m.DashboardPage })))

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
  useThemeEffect()

  return (
    <Suspense>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route element={<SetupGuard />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<PlannerPage />} />
            <Route path="/s/:slug" element={<PlannerPage />} />
            <Route path="/page/:pageId" element={<PageEditorPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:projectName" element={<TasksPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/productivity" element={<ProductivityPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/*" element={<DocumentsPage />} />
            <Route path="/canvas" element={<CanvasPage />} />
            <Route path="/vault" element={<VaultPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/dash" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
