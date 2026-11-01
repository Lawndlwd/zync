import { useSearchParams } from 'react-router'

import { Button } from '../components/Button'
import { Segmented } from '../components/Segmented'
import { identityName, STAGES } from '../helpers/becoming'
import { dateTimeLabel, ymd } from '../helpers/dates'
import { capitalize } from '../helpers/format'
import { identityUrl } from '../helpers/urls'
import { useBecomingInterview } from '../hooks/useBecomingInterview'
import { useBecomingToday } from '../hooks/useBecomingToday'
import { useIdentityPatch } from '../hooks/useIdentityPatch'
import { useNow } from '../hooks/useNow'
import { IconInfo } from '../icons'
import { useShell } from '../shell/ShellContext'
import type { TodayRow } from '../types/becoming'
import { IdentityCard } from './IdentityCard'
import { IdentityDraft } from './IdentityDraft'
import { IdentityPanel } from './IdentityPanel'
import { MirrorView } from './MirrorView'
import { StageColumn } from './StageColumn'

/** Four stages, Experiment → Part of me, each identity with the proof Zync collected for it. */
export function BecomingPage() {
  const { ws } = useShell()
  const now = useNow(60_000)
  const today = ymd(now)
  const [params, setParams] = useSearchParams()
  const { data, error, isLoading } = useBecomingToday(ws, today)
  const patch = useIdentityPatch(ws)
  const interview = useBecomingInterview(ws)
  const tab = params.get('tab') === 'mirror' ? 'mirror' : 'board'
  const week = params.get('week') ?? undefined
  const openFile = params.get('open')
  const creating = params.get('new') === '1'
  const rows = data?.rows ?? []
  const open = rows.find((r) => r.identity.file === openFile)
  const experiment = rows.find((r) => r.identity.stage === 'experiment')
  const inStage = (stage: string) => rows.filter((r) => r.identity.stage === stage)

  const accept = (r: TodayRow) => {
    if (r.progress.suggest) void patch(r.identity.file, { stage: r.progress.suggest })
  }
  // Dismissed: asked again in two weeks.
  const dismiss = (r: TodayRow) => {
    const until = new Date(now)
    until.setDate(until.getDate() + 14)
    void patch(r.identity.file, { quietUntil: ymd(until) })
  }

  return (
    <div className={`board-view${open || creating ? ' with-panel' : ''}`}>
      <div className="board-scroll">
        <div className="page col g20" style={{ padding: '28px 32px 32px' }}>
          <div className="col g12">
            <div className="row between">
              <span className="mono muted">{ws} / becoming</span>
              <span className="mono muted">{dateTimeLabel(now)}</span>
            </div>
            <div className="row between g16 wrap" style={{ alignItems: 'flex-end' }}>
              <div className="col g8">
                <h1 className="display" style={{ fontSize: 44 }}>
                  Becoming
                </h1>
                <p className="lede" style={{ fontSize: 16 }}>
                  Who you’re becoming — and the proof Zync collected for it.
                </p>
              </div>
              <div className="row g8 wrap">
                <Segmented
                  label="Becoming"
                  value={tab}
                  options={[
                    { value: 'board', label: 'Board' },
                    { value: 'mirror', label: 'Mirror' },
                  ]}
                  onChange={(t) => setParams(t === 'mirror' ? { tab: 'mirror' } : {})}
                />
                <Button busy={interview.busy} onClick={() => void interview.start()}>
                  [↗] Ask the AI
                </Button>
                <Button variant="primary" onClick={() => setParams({ new: '1' })}>
                  [+] Identity
                </Button>
              </div>
            </div>
          </div>

          {tab === 'mirror' && <MirrorView ws={ws} week={week} onWeek={(w) => setParams({ tab: 'mirror', week: w })} />}
          {tab === 'board' && error && <p className="lede danger-t">{error.message}</p>}
          {tab === 'board' && isLoading && <div className="skel" style={{ height: 320 }} />}

          {tab === 'board' && data && (
            <div className="becoming-board">
              {STAGES.map((stage) => (
                <StageColumn
                  key={stage}
                  stage={stage}
                  count={inStage(stage).length}
                  note={
                    stage === 'experiment' && experiment ? (
                      <div className="softrule">
                        <IconInfo style={{ marginTop: 2 }} />
                        <span>
                          One experiment at a time — {capitalize(identityName(experiment.identity.statement))} is on day{' '}
                          {experiment.progress.day ?? 1}.
                        </span>
                      </div>
                    ) : undefined
                  }
                  footer={
                    stage === 'experiment' ? (
                      <Button
                        size="sm"
                        className="kadd"
                        disabled={experiment !== undefined}
                        onClick={() => setParams({ new: '1' })}
                      >
                        [+] Add experiment
                      </Button>
                    ) : undefined
                  }
                >
                  {inStage(stage).map((r) => (
                    <IdentityCard
                      key={r.identity.file}
                      row={r}
                      to={identityUrl(ws, r.identity.file)}
                      selected={r.identity.file === openFile}
                      onAccept={() => accept(r)}
                      onDismiss={() => dismiss(r)}
                    />
                  ))}
                </StageColumn>
              ))}
            </div>
          )}

          {tab === 'board' && (
            <div className="row g16 mono-s muted wrap" style={{ marginTop: 4 }}>
              <span className="row g6">
                <i className="sw" style={{ background: 'var(--heat-3)', borderColor: 'transparent' }} />
                Full vote
              </span>
              <span className="row g6">
                <i className="sw" style={{ background: 'var(--heat-1)', borderColor: 'transparent' }} />
                Small vote
              </span>
              <span className="row g6">
                <i className="sw" style={{ background: 'var(--heat-0)' }} />
                No vote
              </span>
              <span className="row g6">
                <i className="sw" style={{ border: '1px dashed var(--line)', background: 'transparent' }} />
                Not started
              </span>
              <span style={{ marginLeft: 'auto' }}>4 weeks · oldest → today</span>
            </div>
          )}
        </div>
      </div>

      {open && <IdentityPanel key={open.identity.file} ws={ws} row={open} onClose={() => setParams({})} />}
      {!open && creating && (
        <IdentityDraft
          ws={ws}
          stage={experiment ? 'trying' : 'experiment'}
          onCreated={(file) => setParams({ open: file })}
          onClose={() => setParams({})}
        />
      )}
    </div>
  )
}
