import { runningCards, upcoming } from '../helpers/boards'
import { hhmm, sameDay, weekdayShort } from '../helpers/dates'
import { IconMenu, IconSearch, IconSpin } from '../icons'
import { GuideButton } from '../onboarding/GuideButton'
import type { Theme } from '../types/shell'
import type { WorkspaceData } from '../types/workspace'
import { AccountMenu } from './AccountMenu'
import { Notifications } from './Notifications'
import { useShell } from './ShellContext'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

export function TopBar({
  data,
  theme,
  setTheme,
  onMenu,
}: {
  data: WorkspaceData
  theme: Theme
  setTheme: (t: Theme) => void
  onMenu: () => void
}) {
  const shell = useShell()
  const now = new Date()
  const running = runningCards(data.cards).length
  const next = upcoming(data.jobs, data.cards, now)[0]
  const nextLabel = next
    ? sameDay(next.time, now)
      ? hhmm(next.time)
      : `${weekdayShort(next.time)} ${hhmm(next.time)}`
    : null
  const me = data.people.find((p) => p.id === 'me')
  const dockOpen = shell.dock !== 'rail'

  return (
    <header className="top">
      <button className="ibtn show-narrow" aria-label="Open navigation" onClick={onMenu}>
        <IconMenu />
      </button>
      <div className="wordmark">
        <i />
        ZYNC
      </div>
      <WorkspaceSwitcher />
      <button
        className="search gsearch"
        aria-label="Search or run a command"
        data-tour="palette"
        onClick={shell.openPalette}
      >
        <IconSearch />
        <span className="grow" style={{ textAlign: 'left' }}>
          Search pages, cards, jobs… or type a command
        </span>
        <span className="kbd">⌘K</span>
      </button>
      <div className="row g8" style={{ marginLeft: 'auto' }}>
        <GuideButton ws={shell.ws} data={data} />
        <button
          className={`aistat${dockOpen ? ' on' : ''}`}
          aria-label={`AI status — ${dockOpen ? 'close' : 'open'} chat`}
          aria-pressed={dockOpen}
          data-tour="chat"
          onClick={shell.toggleDock}
        >
          {running > 0 && <IconSpin />}
          {running > 0 ? `${running} running` : 'Idle'}
          {nextLabel && (
            <>
              <span style={{ opacity: 0.5 }}>·</span>next {nextLabel}
            </>
          )}
          <span className="hide-narrow" style={{ opacity: 0.5 }}>
            ·
          </span>
          <span className="hide-narrow">⌘J</span>
        </button>
        <Notifications data={data} />
        <AccountMenu name={me?.name} theme={theme} setTheme={setTheme} />
      </div>
    </header>
  )
}
