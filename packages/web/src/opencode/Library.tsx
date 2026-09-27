import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { api } from '../api'
import { libraryUrl } from '../helpers/urls'
import { useInlineEntries } from '../hooks/useInlineEntries'
import { IconFile } from '../icons'
import { Health } from './Health'
import { KINDS } from './kinds'
import { KindSection } from './KindSection'
import { RestartBanner } from './RestartBanner'

export function Library({ ws }: { ws: string }) {
  const { data, error } = useQuery({ queryKey: ['opencode-library'], queryFn: api.opencodeLibrary })
  const inline = useInlineEntries()

  return (
    <div className="page col g24">
      <div className="col g16">
        <div className="row between wrap g12">
          <span className="mono muted">{ws} / opencode</span>
          <Health />
        </div>
        <h1 className="display">OpenCode</h1>
        <p className="lede">
          The AI’s setup in one folder: its <b>config</b>, <b>agents</b>, <b>commands</b> and <b>skills</b>. Every chat
          and job runs with it.
        </p>
        {data && <span className="mono-s muted">{data.dir}/</span>}
      </div>
      <RestartBanner />
      {error && <p className="help err">{error.message}</p>}

      <section className="card" aria-label="Config">
        <div className="card-h">
          <span className="t">Config</span>
          <span className="m">models · providers · MCP servers · permissions</span>
        </div>
        <Link to={libraryUrl(ws, 'opencode.json')} className="oc-row">
          <IconFile size={14} />
          <span className="grow col" style={{ minWidth: 0 }}>
            <span className="oc-name">opencode.json</span>
            <span className="small muted trunc">
              The AI server’s settings. zync keeps its own MCP server and job agent in it.
            </span>
          </span>
          <span className="mono-s muted">Edit →</span>
        </Link>
      </section>

      {KINDS.map((k) => (
        <KindSection
          key={k.kind}
          ws={ws}
          spec={k}
          items={(data?.items ?? []).filter((i) => i.kind === k.kind)}
          inline={inline[k.kind]}
          loading={!data && !error}
        />
      ))}
    </div>
  )
}
