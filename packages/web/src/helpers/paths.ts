export function dirname(p: string): string {
  const i = p.lastIndexOf('/')
  return i < 0 ? '' : p.slice(0, i)
}

export function basename(p: string): string {
  return p.slice(p.lastIndexOf('/') + 1)
}

export function joinPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name
}

/** A '/'-separated path with each segment URL-encoded (the slashes stay). */
export const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/')

/** A file name without its `.md` extension (and without its folder). */
export const stripMd = (p: string) => basename(p).replace(/\.md$/, '')

/** The inverse of encodePath. */
export const decodePath = (p: string) => p.split('/').map(decodeURIComponent).join('/')
