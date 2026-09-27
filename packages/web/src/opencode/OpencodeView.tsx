import { useParams } from 'react-router'

import { OpencodeConfig } from '../settings/OpencodeConfig'
import { Crumbs } from './Crumbs'
import { Library } from './Library'
import { LibraryFile } from './LibraryFile'
import { RestartBanner } from './RestartBanner'

// The AI's setup in one place: opencode.json plus the agents, commands and skills that live next to
// it in opencode's config folder. Every entry is a markdown file (frontmatter + body), edited with
// the same page editor as Files.

export function OpencodeView() {
  const { ws = '', '*': splat = '' } = useParams()
  const path = decodeURIComponent(splat)
  if (!path) return <Library ws={ws} />
  if (path === 'opencode.json')
    return (
      <div className="page col g24">
        <Crumbs ws={ws} parts={['opencode.json']} />
        <RestartBanner />
        <OpencodeConfig />
      </div>
    )
  return <LibraryFile key={path} ws={ws} path={path} />
}
