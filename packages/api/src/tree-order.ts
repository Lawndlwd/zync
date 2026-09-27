import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

// The order you give files and folders in the sidebar (drag and drop). The filesystem has none, so
// it is kept per workspace in <ws>/.zync/order.json: { "<folder, '' = root>": ["name", …] }.
// Names not in the list (new files, files added by the AI) come after, in the default order.

type Order = Record<string, string[]>

const orderFile = (wsPath: string) => path.join(wsPath, '.zync', 'order.json')

export async function readOrder(wsPath: string): Promise<Order> {
  try {
    const raw = JSON.parse(await readFile(orderFile(wsPath), 'utf8'))
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  } catch {
    return {}
  }
}

async function writeOrder(wsPath: string, order: Order): Promise<void> {
  for (const [k, v] of Object.entries(order)) if (!v.length) delete order[k]
  await mkdir(path.dirname(orderFile(wsPath)), { recursive: true })
  await writeFile(orderFile(wsPath), `${JSON.stringify(order, null, 2)}\n`)
}

/** Sort entries of one folder: the saved order first, the rest after in their current order. */
export function applyOrder<T extends { name: string }>(entries: T[], names: string[] | undefined): T[] {
  if (!names?.length) return entries
  const rank = new Map(names.map((n, i) => [n, i]))
  const listed = entries.filter((e) => rank.has(e.name)).sort((a, b) => rank.get(a.name)! - rank.get(b.name)!)
  return [...listed, ...entries.filter((e) => !rank.has(e.name))]
}

export async function setOrder(wsPath: string, dir: string, names: string[]): Promise<void> {
  const order = await readOrder(wsPath)
  order[dir] = [...new Set(names.filter((n) => typeof n === 'string' && n && !n.includes('/')))]
  await writeOrder(wsPath, order)
}

/** Keep the order in step with a move or rename (workspace-relative, '/'-separated paths). */
export async function renameInOrder(wsPath: string, from: string, to: string): Promise<void> {
  const order = await readOrder(wsPath)
  if (!Object.keys(order).length) return
  const split = (p: string) => {
    const i = p.lastIndexOf('/')
    return i < 0 ? ['', p] : [p.slice(0, i), p.slice(i + 1)]
  }
  const [fromDir, fromName] = split(from)
  const [toDir, toName] = split(to)
  const list = order[fromDir]
  if (list?.includes(fromName)) {
    if (fromDir === toDir) list[list.indexOf(fromName)] = toName
    else order[fromDir] = list.filter((n) => n !== fromName)
  }
  // A moved folder takes its own and its subfolders' orders along.
  for (const key of Object.keys(order)) {
    if (key === from || key.startsWith(`${from}/`)) {
      order[to + key.slice(from.length)] = order[key]
      delete order[key]
    }
  }
  await writeOrder(wsPath, order)
}
