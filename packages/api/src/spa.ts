import path from 'node:path'

import type { NextFunction, Request, Response } from 'express'

/** The app's own pages (index.html): home, sign-in, workspaces. */
const isPage = (p: string) => p === '/' || p === '/login' || p === '/w' || p.startsWith('/w/')

/** zync's API, assets and page routes. `/` is shared: the app's home, opencode's inside the chat frame. */
const isZyncPath = (p: string) => p.startsWith('/zync/') || (p !== '/' && isPage(p))

/** Paths the app serves itself; everything else belongs to opencode when the proxy is on. */
export const isAppPath = (url: string) => {
  const p = url.split('?', 1)[0] ?? ''
  return p === '/' || isZyncPath(p)
}

/**
 * The web app's pages (index.html for its routes, with `csp` when given) and, when a proxy is
 * given, opencode for every other path.
 */
export function appFallback(web: string | null, proxy: ((req: Request, res: Response) => void) | null, csp?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // opencode's own home page, when navigated to inside the chat frame.
    const inFrame = req.get('sec-fetch-dest') === 'iframe'
    if (web && req.method === 'GET' && isPage(req.path) && !(inFrame && req.path === '/')) {
      if (csp) res.setHeader('Content-Security-Policy', csp)
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(path.join(web, 'index.html'))
      return
    }
    if (proxy && !isZyncPath(req.path)) {
      proxy(req, res)
      return
    }
    next()
  }
}
