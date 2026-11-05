import type { Request, Response } from 'express'

// opencode v2's web UI registers /sw.js with scope "/". Sharing zync's origin, its worker answers
// every navigation (/, /w/*, /login) with opencode's own index.html, before the request reaches the
// server. So zync answers /sw.js itself with a worker that replaces it and handles nothing.
//
// It stays registered, without a fetch listener, because opencode registers /sw.js on each load:
// unregistering would only repeat this on every chat frame. opencode's precache is the sign that
// its worker was here, so open tabs reload once and a new registration never does.
export const OPENCODE_SW_REPLACEMENT = `self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const stale = (await caches.keys()).filter((name) => name.startsWith('workbox-'))
      if (stale.length === 0) return
      await Promise.all(stale.map((name) => caches.delete(name)))
      const tabs = await self.clients.matchAll({ type: 'window' })
      await Promise.allSettled(
        tabs.filter((tab) => tab.frameType === 'top-level').map((tab) => tab.navigate(tab.url)),
      )
    })(),
  )
})
`

export function opencodeSwReplacement(_req: Request, res: Response) {
  res.type('text/javascript')
  res.setHeader('Cache-Control', 'no-cache')
  res.send(OPENCODE_SW_REPLACEMENT)
}
