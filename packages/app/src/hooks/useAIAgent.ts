import { useCallback } from 'react'
import { useChatStore } from '@/store/chat'
import { streamChat } from '@/services/llm'
import type { LLMMessage } from '@/services/llm'

export function useAIAgent() {
  const { messages, addMessage, appendToMessage, updateMessage, setLoading } = useChatStore()

  const sendMessage = useCallback(
    async (content: string) => {
      addMessage('user', content)
      setLoading(true)

      const assistantMsg = addMessage('assistant', '')

      const llmMessages: LLMMessage[] = [
        ...messages.map((m) => ({ role: m.role as LLMMessage['role'], content: m.content })),
        { role: 'user' as const, content },
      ]

      try {
        await streamChat(
          llmMessages,
          {
            onToken: (token) => appendToMessage(assistantMsg.id, token),
            onToolCall: (toolCall) => {
              appendToMessage(assistantMsg.id, `\n\n*Using ${toolCall.name}...*\n\n`)
            },
            onToolResult: () => {},
            onDone: () => {},
            onError: (error) => {
              updateMessage(assistantMsg.id, {
                content: `Error: ${error.message}`,
                isStreaming: false,
              })
              setLoading(false)
            },
          }
        )

        updateMessage(assistantMsg.id, { isStreaming: false })
        setLoading(false)
      } catch (error) {
        updateMessage(assistantMsg.id, {
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isStreaming: false,
        })
        setLoading(false)
      }
    },
    [messages, addMessage, appendToMessage, updateMessage, setLoading]
  )

  return { sendMessage }
}
