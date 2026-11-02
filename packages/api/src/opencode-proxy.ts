import http, { type IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'

import type { Request, Response } from 'express'

// opencode's web UI served through the app's own domain, so opencode never needs a public address.
// opencode has no base-path option, so it keeps the root: zync lives under /zync/*, "/" and /w/*,
// and everything else is forwarded here (HTTP, event streams and websocket upgrades).
// opencode wants HTTP Basic auth; the proxy adds it, so the browser never holds opencode's password
// and only zync's own sign-in (auth/guard) stands in front.

const HOP = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer']

function forwardHeaders(req: IncomingMessage, target: URL, auth?: string): http.OutgoingHttpHeaders {
  const headers: http.OutgoingHttpHeaders = { ...req.headers, host: target.host }
  for (const h of HOP) delete headers[h]
  // The browser talks to the app's origin; opencode would treat that Origin as a foreign site.
  delete headers.origin
  delete headers.authorization
  if (auth) headers.authorization = auth
  return headers
}

export function opencodeProxy(targetUrl: string, auth?: string) {
  const target = new URL(targetUrl)
  return (req: Request, res: Response) => {
    const url = new URL(req.originalUrl, target)
    const upstream = http.request(url, { method: req.method, headers: forwardHeaders(req, target, auth) }, (up) => {
      const headers = { ...up.headers }
      for (const h of HOP) delete headers[h]
      // A refusal must not open the browser's own password box.
      delete headers['www-authenticate']
      res.writeHead(up.statusCode ?? 502, headers)
      // Event streams must reach the browser as they arrive.
      if (up.headers['content-type']?.includes('text/event-stream')) res.flushHeaders()
      up.pipe(res)
    })
    upstream.on('error', (err) => {
      if (res.headersSent) res.destroy(err)
      else res.status(502).json({ error: `AI server unreachable: ${err.message}` })
    })
    req.on('aborted', () => upstream.destroy())
    req.pipe(upstream)
  }
}

/** Websocket upgrades (opencode's terminal) for everything outside the app's own paths. */
export function opencodeUpgrade(targetUrl: string, isAppPath: (path: string) => boolean, auth?: string) {
  const target = new URL(targetUrl)
  return (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (isAppPath(req.url ?? '/')) {
      socket.destroy()
      return
    }
    const headers = { ...req.headers, host: target.host }
    delete headers.origin
    delete headers.authorization
    if (auth) headers.authorization = auth
    const upstream = http.request(new URL(req.url ?? '/', target), { method: req.method, headers })
    upstream.on('upgrade', (res, upSocket, upHead) => {
      const lines = [`HTTP/1.1 ${res.statusCode} ${res.statusMessage}`]
      for (let i = 0; i < res.rawHeaders.length; i += 2) lines.push(`${res.rawHeaders[i]}: ${res.rawHeaders[i + 1]}`)
      socket.write(`${lines.join('\r\n')}\r\n\r\n`)
      if (upHead.length) socket.write(upHead)
      if (head.length) upSocket.write(head)
      upSocket.pipe(socket).pipe(upSocket)
      const end = () => {
        upSocket.destroy()
        socket.destroy()
      }
      upSocket.on('error', end)
      socket.on('error', end)
    })
    upstream.on('response', (res) => {
      // Refused the upgrade: pass the answer on and close.
      socket.end(`HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n\r\n`)
    })
    upstream.on('error', () => socket.destroy())
    upstream.end()
  }
}
