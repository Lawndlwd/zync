import { Navigate, Route } from 'react-router'
import { BoardsList } from './boards/BoardsList'
import { BoardView } from './boards/BoardView'
import { CalendarView } from './calendar/CalendarView'
import { FileView } from './FileView'
import { JobsView } from './JobsView'
import { MemoryView } from './memory/MemoryView'
import { Overview } from './Overview'
import { OpencodeView } from './opencode/OpencodeView'
import { PeopleView } from './PeopleView'
import { SettingsView } from './SettingsView'

/** The views under /w/:ws — used by the main page and by every split pane, so they always match. */
export function workspaceViews() {
  return (
    <>
      <Route index element={<Navigate to="overview" replace />} />
      <Route path="overview" element={<Overview />} />
      <Route path="files/*" element={<FileView />} />
      <Route path="boards" element={<BoardsList />} />
      <Route path="boards/*" element={<BoardView />} />
      <Route path="calendar" element={<CalendarView />} />
      <Route path="people" element={<PeopleView />} />
      <Route path="memory" element={<MemoryView />} />
      <Route path="jobs" element={<JobsView />} />
      <Route path="opencode" element={<OpencodeView />} />
      <Route path="opencode/*" element={<OpencodeView />} />
      <Route path="settings" element={<SettingsView />} />
    </>
  )
}
