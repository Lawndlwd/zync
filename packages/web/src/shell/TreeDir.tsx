import { useQuery } from '@tanstack/react-query'

import { api } from '../api'
import { useShowHidden } from '../hooks/useShowHidden'
import type { TreeCtx } from '../types/shell'
import { TreeNameInput } from './TreeNameInput'
import { TreeNode } from './TreeNode'

export function TreeDir({ path, depth, ctx }: { path: string; depth: number; ctx: TreeCtx }) {
  const [hidden] = useShowHidden()
  const { data, error } = useQuery({
    queryKey: ['tree', ctx.ws, path, hidden],
    queryFn: () => api.tree(ctx.ws, path, hidden),
  })
  const creatingHere = ctx.creating?.dir === path
  if (error)
    return (
      <div className="help err" style={{ padding: '0 10px' }}>
        {error.message}
      </div>
    )
  return (
    <>
      {creatingHere && <TreeNameInput depth={depth} ctx={ctx} />}
      {data?.entries.map((e) => (
        <TreeNode key={e.path} entry={e} depth={depth} ctx={ctx} siblings={data.entries}>
          {(childPath, childDepth) => <TreeDir path={childPath} depth={childDepth} ctx={ctx} />}
        </TreeNode>
      ))}
      {data && !data.entries.length && depth === 0 && !creatingHere && (
        <span className="ti muted">Empty workspace</span>
      )}
    </>
  )
}
