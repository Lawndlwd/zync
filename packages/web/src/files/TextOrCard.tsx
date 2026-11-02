import { useQuery } from '@tanstack/react-query'

import { api } from '../api'
import { isIdentityPath, isMirrorPath } from '../helpers/becoming'
import { dirname } from '../helpers/paths'
import { CardFile } from './CardFile'
import { IdentityFile } from './IdentityFile'
import { MirrorFile } from './MirrorFile'
import { PageSkeleton } from './PageSkeleton'
import { TextFile } from './TextFile'

/**
 * A markdown file inside a board folder is a card: open it as the card page, same as the board panel.
 * One directly in Becoming/ is an identity page, one in Becoming/Mirror/ a week's Mirror.
 */
export function TextOrCard({ ws, path }: { ws: string; path: string }) {
  const { data: boards } = useQuery({ queryKey: ['boards', ws], queryFn: () => api.boards(ws) })
  if (isIdentityPath(path)) return <IdentityFile ws={ws} path={path} />
  if (isMirrorPath(path)) return <MirrorFile ws={ws} path={path} />
  if (!boards) return <PageSkeleton ws={ws} path={path} />
  const board = path.endsWith('.md') ? boards.find((b) => b.path === dirname(path)) : undefined
  return board ? <CardFile ws={ws} path={path} board={board} /> : <TextFile ws={ws} path={path} />
}
