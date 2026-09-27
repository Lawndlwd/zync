// Links between workspace files are plain relative markdown links (`[Plan](../plans/q3.md)`), so they
// also work on GitHub, in Obsidian and for the AI reading the files. Paths are workspace-relative.

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i

const segments = (p: string) => p.split('/').filter((s) => s && s !== '.')

/** Link from a document in folder `fromDir` to workspace file `target`, URL-encoded per segment. */
export function relativeLink(fromDir: string, target: string): string {
  const from = segments(fromDir)
  const to = segments(target)
  let i = 0
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++
  return [...from.slice(i).map(() => '..'), ...to.slice(i)].map(encodeURIComponent).join('/')
}

/** Workspace path an `href` in a document in `fromDir` points at; null for external links or ones leaving the workspace. */
export function resolveLink(fromDir: string, href: string): string | null {
  if (!href || EXTERNAL.test(href)) return null
  let path = href.replace(/[?#].*$/, '')
  try {
    path = decodeURIComponent(path)
  } catch {}
  const out = path.startsWith('/') ? [] : segments(fromDir)
  for (const s of segments(path)) {
    if (s !== '..') out.push(s)
    else if (!out.pop()) return null
  }
  return out.length ? out.join('/') : null
}

/** File name without its markdown extension — what a link to it reads as. */
export const pageTitle = (name: string) => name.replace(/\.md$/i, '')
