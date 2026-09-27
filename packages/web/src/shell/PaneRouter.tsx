import { useMemo } from 'react'
import { MemoryRouter, Route, Routes, UNSAFE_LocationContext, UNSAFE_RouteContext } from 'react-router'

import { workspaceViews } from '../routes'
import { PaneNavBridge } from './PaneNavBridge'
import { PaneReporter } from './PaneReporter'

export function PaneRouter({
  initial,
  onPath,
  onEscape,
  register,
}: {
  initial: string
  onPath: (path: string) => void
  onEscape: (path: string) => void
  register: (go: ((to: string) => void) | null) => void
}) {
  // react-router refuses a router inside a router; a pane is deliberately a separate one, so it
  // starts from an empty router context instead of the main window's.
  const routeContextValue = useMemo(() => ({ outlet: null, matches: [], isDataRoute: false }), [])
  return (
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- react-router's LocationContext type doesn't allow null; we intentionally break the context chain so the pane gets its own router
    <UNSAFE_LocationContext.Provider value={null as never}>
      <UNSAFE_RouteContext.Provider value={routeContextValue}>
        <MemoryRouter initialEntries={[initial]} useTransitions={false}>
          <PaneReporter onPath={onPath} onEscape={onEscape} />
          <PaneNavBridge register={register} />
          <Routes>
            <Route path="/w/:ws">
              {workspaceViews()}
              <Route path="*" element={<p className="page small muted">Nothing to show here.</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </UNSAFE_RouteContext.Provider>
    </UNSAFE_LocationContext.Provider>
  )
}
