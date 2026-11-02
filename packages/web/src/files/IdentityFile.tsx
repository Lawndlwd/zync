import { IdentityDocument } from '../becoming/IdentityDocument'
import { ButtonLink } from '../components/ButtonLink'
import { STAGE_LABEL } from '../helpers/becoming'
import { ymd } from '../helpers/dates'
import { basename } from '../helpers/paths'
import { identityUrl } from '../helpers/urls'
import { useBecomingToday } from '../hooks/useBecomingToday'
import { useIdentityPatch } from '../hooks/useIdentityPatch'
import { useNow } from '../hooks/useNow'
import { IconBecoming } from '../icons'
import { PageSkeleton } from './PageSkeleton'
import { PathBar } from './PathBar'
import { TextFile } from './TextFile'

/** A page in Becoming/ is an identity: opened in Files, it is the same page as on the board. */
export function IdentityFile({ ws, path }: { ws: string; path: string }) {
  const now = useNow(60_000)
  const { data, error } = useBecomingToday(ws, ymd(now))
  const patch = useIdentityPatch(ws)
  const file = basename(path)
  const row = data?.rows.find((r) => r.identity.file === file)
  if (error) return <TextFile ws={ws} path={path} />
  if (!data) return <PageSkeleton ws={ws} path={path} />
  if (!row) return <TextFile ws={ws} path={path} />
  return (
    <div className="fileview">
      <PathBar ws={ws} path={path} />
      <div className="page file-page">
        <div className="doc col g20">
          <div className="card-banner row g12">
            <IconBecoming size={16} />
            <span className="grow small">
              This page is an identity · stage <b style={{ fontWeight: 600 }}>{STAGE_LABEL[row.identity.stage]}</b>
            </span>
            <ButtonLink variant="primary" size="sm" to={identityUrl(ws, file)}>
              [↗] Open Becoming
            </ButtonLink>
          </div>
          <IdentityDocument ws={ws} identity={row.identity} strip={row.strip} onPatch={(p) => patch(file, p)} />
        </div>
      </div>
    </div>
  )
}
