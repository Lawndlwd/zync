import type { PRAgentResult } from '@/store/pr-agent'

export interface ParsedReviewCommand {
  provider: 'gitlab' | 'github'
  target: string // MR/PR URL or branch name
}

/**
 * Run a PR-Agent review via SSE, calling back with status updates and final result.
 */
export function runPRReview(
  cmd: ParsedReviewCommand,
  onStatus: (status: string) => void,
  onResult: (result: PRAgentResult) => void,
  onError: (error: string) => void,
): AbortController {
  const controller = new AbortController()

  ;(async () => {
    try {
      const mrUrl = cmd.target
      const response = await fetch('/api/pr-agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'review',
          mrUrl,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json()
        onError(err.error || err.message || `HTTP ${response.status}`)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        onError('No response body')
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      const processLines = (lines: string[]) => {
        let currentEvent = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              switch (currentEvent) {
                case 'status':
                  onStatus(data.message)
                  break
                case 'result':
                  onResult(data as PRAgentResult)
                  break
                case 'error':
                  onError(data.message)
                  break
              }
            } catch {
              // skip malformed
            }
          }
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        processLines(lines)
      }

      if (buffer.trim()) {
        processLines(buffer.split('\n'))
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        onError(err.message || 'PR review failed')
      }
    }
  })()

  return controller
}
