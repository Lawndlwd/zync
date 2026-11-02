import { lazy, type ReactNode, Suspense } from 'react'
import { Navigate, Route } from 'react-router'

import { Loading } from './components/Loading'

// Each view is its own chunk, loaded the first time it opens.
const BecomingPage = lazy(() => import('./becoming/BecomingPage').then((m) => ({ default: m.BecomingPage })))

const BoardsList = lazy(() => import('./boards/BoardsList').then((m) => ({ default: m.BoardsList })))

const BoardView = lazy(() => import('./boards/BoardView').then((m) => ({ default: m.BoardView })))

const CalendarView = lazy(() => import('./calendar/CalendarView').then((m) => ({ default: m.CalendarView })))

const FileView = lazy(() => import('./files/FileView').then((m) => ({ default: m.FileView })))

const JobsView = lazy(() => import('./jobs/JobsView').then((m) => ({ default: m.JobsView })))

const MemoryView = lazy(() => import('./memory/MemoryView').then((m) => ({ default: m.MemoryView })))

const OpencodeView = lazy(() => import('./opencode/OpencodeView').then((m) => ({ default: m.OpencodeView })))

const Overview = lazy(() => import('./overview/Overview').then((m) => ({ default: m.Overview })))

const PeopleView = lazy(() => import('./people/PeopleView').then((m) => ({ default: m.PeopleView })))

const SettingsView = lazy(() => import('./settings/SettingsView').then((m) => ({ default: m.SettingsView })))

const TrainingPage = lazy(() => import('./training/TrainingPage').then((m) => ({ default: m.TrainingPage })))

const TrainingSetup = lazy(() => import('./training/TrainingSetup').then((m) => ({ default: m.TrainingSetup })))

const LiveWorkout = lazy(() => import('./training/LiveWorkout').then((m) => ({ default: m.LiveWorkout })))

const view = (el: ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>

/** The views under /w/:ws — used by the main page and by every split pane, so they always match. */
export function workspaceViews() {
  return (
    <>
      <Route index element={<Navigate to="overview" replace />} />
      <Route path="overview" element={view(<Overview />)} />
      <Route path="files/*" element={view(<FileView />)} />
      <Route path="boards" element={view(<BoardsList />)} />
      <Route path="boards/*" element={view(<BoardView />)} />
      <Route path="calendar" element={view(<CalendarView />)} />
      <Route path="becoming" element={view(<BecomingPage />)} />
      <Route path="training" element={view(<TrainingPage tab="today" />)} />
      <Route path="training/routines" element={view(<TrainingPage tab="routines" />)} />
      <Route path="training/log" element={view(<TrainingPage tab="log" />)} />
      <Route path="training/progress" element={view(<TrainingPage tab="progress" />)} />
      <Route path="training/library" element={view(<TrainingPage tab="library" />)} />
      <Route path="training/setup" element={view(<TrainingSetup />)} />
      <Route path="training/workout/:file" element={view(<LiveWorkout />)} />
      <Route path="people" element={view(<PeopleView />)} />
      <Route path="memory" element={view(<MemoryView />)} />
      <Route path="jobs" element={view(<JobsView />)} />
      <Route path="opencode" element={view(<OpencodeView />)} />
      <Route path="opencode/*" element={view(<OpencodeView />)} />
      <Route path="settings" element={view(<SettingsView />)} />
    </>
  )
}
