import http, { type IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'

import type { Request, Response } from 'express'

// opencode's web UI served through the app's own domain, so opencode never needs a public address.
// opencode has no base-path option, so it keeps the root: zync lives under /zync/*, "/" and /w/*,
// and everything else is forwarded here (HTTP, event streams and websocket upgrades).

const HOP = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer']

function forwardHeaders(req: IncomingMessage, target: URL): http.OutgoingHttpHeaders {
  const headers: http.OutgoingHttpHeaders = { ...req.headers, host: target.host }
  for (const h of HOP) delete headers[h]
  // The browser talks to the app's origin; opencode would treat that Origin as a foreign site.
  delete headers.origin
  return headers
}

export function opencodeProxy(targetUrl: string) {
  const target = new URL(targetUrl)
  return (req: Request, res: Response) => {
    const url = new URL(req.originalUrl, target)
    const upstream = http.request(url, { method: req.method, headers: forwardHeaders(req, target) }, (up) => {
      const headers = { ...up.headers }
      for (const h of HOP) delete headers[h]
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
export function opencodeUpgrade(targetUrl: string, isAppPath: (path: string) => boolean) {
  const target = new URL(targetUrl)
  return (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (isAppPath(req.url ?? '/')) {
      socket.destroy()
      return
    }
    const headers = { ...req.headers, host: target.host }
    delete headers.origin
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
