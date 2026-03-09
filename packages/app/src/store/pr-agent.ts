import { create } from 'zustand'
import toast from 'react-hot-toast'

type PRAgentTool = 'review' | 'describe' | 'improve' | 'ask'

export interface PRAgentItem {
  severity: 'critical' | 'warning' | 'suggestion' | 'info'
  title: string
  file?: string
  line?: number
  body: string
  suggestion?: string
}

export interface PRAgentResult {
  tool: PRAgentTool
  summary: string
  score?: number
  items: PRAgentItem[]
  rawOutput?: string
}

interface PromptInfo {
  model: string
  system: string
  system_length: number
  user: string
  user_length: number
  temperature: number
}

export interface DebugInfo {
  extraInstructions?: string
  prompts: PromptInfo[]
  fullSystem: string[]
  fullUser: string[]
}

interface RunOptions {
  question?: string
  extraInstructions?: string
}

export interface ChatMessage {
  id: number | string
  tool: PRAgentTool
  result: PRAgentResult
  headSha: string
  createdAt: string
}

interface ActiveRun {
  tool: PRAgentTool
  isRunning: boolean
  status: string
  error: string | null
  streamContent: string
  debugInfo: DebugInfo | null
}

interface MRState {
  messages: ChatMessage[]
  activeRun: ActiveRun | null
  loaded: boolean
}

interface PRAgentStore {
  mrs: Record<string, MRState>
  getMessages: (key: string) => ChatMessage[]
  getActiveRun: (key: string) => ActiveRun | null
  isLoaded: (key: string) => boolean
  loadHistory: (key: string, projectId: number, mrIid: number) => Promise<void>
  run: (
    key: string,
    tool: PRAgentTool,
    params: { mrWebUrl: string; projectId: number; mrIid: number; headSha?: string },
    options?: RunOptions,
  ) => void
}

const defaultMR = (): MRState => ({
  messages: [],
  activeRun: null,
  loaded: false,
})

export const usePRAgentStore = create<PRAgentStore>()((set, get) => ({
  mrs: {},

  getMessages: (key) => get().mrs[key]?.messages ?? [],

  getActiveRun: (key) => get().mrs[key]?.activeRun ?? null,

  isLoaded: (key) => get().mrs[key]?.loaded ?? false,

  loadHistory: async (key, projectId, mrIid) => {
    // Don't reload if already loaded
    if (get().mrs[key]?.loaded) return

    try {
      const res = await fetch(`/api/pr-agent/results/${projectId}/${mrIid}`)
      const data = await res.json()
      set((s) => ({
        mrs: {
          ...s.mrs,
          [key]: {
            ...(s.mrs[key] ?? defaultMR()),
            messages: data as ChatMessage[],
            loaded: true,
          },
        },
      }))
    } catch {
      set((s) => ({
        mrs: {
          ...s.mrs,
          [key]: { ...(s.mrs[key] ?? defaultMR()), loaded: true },
        },
      }))
    }
  },

  run: (key, tool, params, options) => {
    const debugRef: DebugInfo = { prompts: [], fullSystem: [], fullUser: [] }

    const patchRun = (partial: Partial<ActiveRun>) =>
      set((s) => {
        const mr = s.mrs[key] ?? defaultMR()
        const current = mr.activeRun ?? {
          tool, isRunning: true, status: '', error: null, streamContent: '', debugInfo: null,
        }
        return {
          mrs: { ...s.mrs, [key]: { ...mr, activeRun: { ...current, ...partial } } },
        }
      })

    const addMessage = (msg: ChatMessage) =>
      set((s) => {
        const mr = s.mrs[key] ?? defaultMR()
        return {
          mrs: {
            ...s.mrs,
            [key]: {
              ...mr,
              messages: [...mr.messages, msg],
              activeRun: null,
            },
          },
        }
      })

    const setError = (error: string) =>
      set((s) => {
        const mr = s.mrs[key] ?? defaultMR()
        return {
          mrs: {
            ...s.mrs,
            [key]: {
              ...mr,
              activeRun: mr.activeRun
                ? { ...mr.activeRun, isRunning: false, status: '', error }
                : null,
            },
          },
        }
      })

    patchRun({
      tool,
      isRunning: true,
      status: `Starting /${tool}...`,
      error: null,
      streamContent: '',
      debugInfo: null,
    })

    ;(async () => {
      try {
        const response = await fetch('/api/pr-agent/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool,
            mrUrl: params.mrWebUrl,
            projectId: params.projectId,
            mrIid: params.mrIid,
            headSha: params.headSha,
            question: options?.question,
            extraInstructions: options?.extraInstructions,
          }),
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || err.message || `HTTP ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

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
                    patchRun({ status: data.message })
                    break
                  case 'chunk': {
                    const prev = get().mrs[key]?.activeRun?.streamContent ?? ''
                    patchRun({ streamContent: prev ? `${prev}\n\n${data.content}` : data.content })
                    break
                  }
                  case 'prompt':
                    debugRef.prompts.push(data)
                    patchRun({ debugInfo: { ...debugRef } })
                    break
                  case 'prompt_system':
                    debugRef.fullSystem.push(data.line)
                    patchRun({ debugInfo: { ...debugRef } })
                    break
                  case 'prompt_user':
                    debugRef.fullUser.push(data.line)
                    patchRun({ debugInfo: { ...debugRef } })
                    break
                  case 'debug':
                    debugRef.extraInstructions = data.extraInstructions
                    patchRun({ debugInfo: { ...debugRef } })
                    break
                  case 'result': {
                    const result = data as PRAgentResult
                    addMessage({
                      id: Date.now(),
                      tool: result.tool || tool,
                      result,
                      headSha: params.headSha || '',
                      createdAt: new Date().toISOString(),
                    })
                    toast.success(`/${result.tool || tool} completed`)
                    break
                  }
                  case 'error':
                    setError(data.message)
                    toast.error(data.message)
                    break
                }
              } catch {
                // skip malformed SSE lines
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

        // Process any remaining data in the buffer
        if (buffer.trim()) {
          processLines(buffer.split('\n'))
        }

        // If stream ended without a result/error event, clear the run
        const currentRun = get().mrs[key]?.activeRun
        if (currentRun?.isRunning) {
          patchRun({ isRunning: false, status: '' })
        }
      } catch (err: any) {
        setError(err.message)
        toast.error(err.message || 'PR-Agent failed')
      }
    })()
  },
}))
