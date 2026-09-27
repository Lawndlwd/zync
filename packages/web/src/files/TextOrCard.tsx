import { useQuery } from '@tanstack/react-query'

import { api } from '../api'
import { dirname } from '../helpers/paths'
import { CardFile } from './CardFile'
import { PageSkeleton } from './PageSkeleton'
import { TextFile } from './TextFile'

/** A markdown file inside a board folder is a card: open it as the card page, same as the board panel. */
export function TextOrCard({ ws, path }: { ws: string; path: string }) {
  const { data: boards } = useQuery({ queryKey: ['boards', ws], queryFn: () => api.boards(ws) })
  if (!boards) return <PageSkeleton ws={ws} path={path} />
  const board = path.endsWith('.md') ? boards.find((b) => b.path === dirname(path)) : undefined
  return board ? <CardFile ws={ws} path={path} board={board} /> : <TextFile ws={ws} path={path} />
}
