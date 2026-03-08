import { useState, useCallback, useRef, useEffect } from 'react'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'
import { useChatStore } from '@/store/chat'
import { streamChat, type LLMMessage } from '@/services/llm'
import { useVoiceSettings } from '@/hooks/useVoiceSettings'
import { useOpenWakeWord } from '@/hooks/useOpenWakeWord'
import { useWakeWord } from '@/hooks/useWakeWord'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type VoiceState = 'hidden' | 'recording' | 'transcribing' | 'responding'

export interface VoiceMessage {
  role: 'user' | 'assistant'
  content: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const HARD_TIMEOUT_MS = 15_000

// Phrases that close the voice conversation
const CLOSE_PHRASES = ['done', 'close', 'that\'s all', 'goodbye', 'bye', 'stop', 'never mind']

// Known Whisper hallucinations on silence / noise
const HALLUCINATION_PATTERNS = [
  /^thanks?\s*(for\s+watching|for\s+listening)/i,
  /^(please\s+)?(like\s+and\s+)?subscribe/i,
  /^(be\s+sure\s+to\s+)?subscribe/i,
  /^\[.*\]$/,                    // [BLANK_AUDIO], [silence], etc.
  /^\(.*\)$/,                    // (silence), (music), etc.
  /^♪+$/,                        // music notes
  /^\.{2,}$/,                    // just dots
  /^[\s\p{P}]*$/u,              // only whitespace / punctuation
]

// Single-word noise artifacts (NOT used for multi-word — user needs "done", "go", etc.)
const SINGLE_WORD_NOISE = new Set([
  'um', 'uh', 'hmm', 'hm', 'mm', 'mhm', 'ah', 'ahh', 'oh', 'ohh', 'eh',
])

// Minimum audio blob size in bytes — below this it's almost certainly silence.
// ~2 KB is about 0.1s of webm audio; real speech is typically 10KB+.
const MIN_AUDIO_BYTES = 4000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isNoiseTranscription(text: string): boolean {
  const trimmed = text.trim()

  // Too short to be meaningful
  if (trimmed.length < 3) return true

  // Known hallucination patterns
  if (HALLUCINATION_PATTERNS.some((p) => p.test(trimmed))) return true

  // Single noise word ("um", "ahh", etc.)
  const lower = trimmed.toLowerCase().replace(/[.!?,;:…]+$/, '')
  if (SINGLE_WORD_NOISE.has(lower)) return true

  // Highly repetitive text — same short phrase looped (Whisper looping artifact)
  // e.g. "Okay. Okay. Okay. Okay." or "Thank you. Thank you. Thank you."
  const sentences = trimmed.split(/[.!?]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
  if (sentences.length >= 4) {
    const unique = new Set(sentences)
    if (unique.size <= 2) return true
  }

  return false
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useVoiceConversation() {
  const [state, setState] = useState<VoiceState>('hidden')
  const [elapsed, setElapsed] = useState(0)
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  // Conversation history for multi-turn LLM context
  const conversationRef = useRef<LLMMessage[]>([])

  // Persistent mic stream — stays open for the entire conversation
  const persistentStreamRef = useRef<MediaStream | null>(null)
  // Per-utterance MediaRecorder (started/stopped on speech/silence)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Capture state tracked via ref (avoids stale closures)
  const isCapturingRef = useRef(false)
  const calibratedRef = useRef(false)
  const isProcessingRef = useRef(false)
  const audioQueueRef = useRef<Blob[]>([])
  const closedRef = useRef(true)

  const analyser = useAudioAnalyser()
  const { addMessage, appendToMessage, updateMessage } = useChatStore()
  const assistantMsgIdRef = useRef<string | null>(null)
  const assistantContentRef = useRef('')

  const { wakeWordEnabled, toggleWakeWord } = useVoiceSettings()

  // Wake word detection: openWakeWord WS -> Web Speech API fallback
  const openWakeWord = useOpenWakeWord({
    onDetected: () => {
      if (state === 'hidden') openConversationRef.current?.(true)
    },
  })
  const webSpeechWakeWord = useWakeWord({
    onDetected: () => {
      if (state === 'hidden') openConversationRef.current?.(true)
    },
  })
  const openConversationRef = useRef<((fromWakeWord?: boolean) => void) | null>(null)

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const clearTimers = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
    if (hardTimeoutRef.current) {
      clearTimeout(hardTimeoutRef.current)
      hardTimeoutRef.current = null
    }
  }, [])

  const isCloseCommand = useCallback((text: string) => {
    const lower = text.toLowerCase().trim().replace(/[.!?,;:…]+$/, '')
    return CLOSE_PHRASES.some((phrase) => lower === phrase)
  }, [])

  // ---------------------------------------------------------------------------
  // Close conversation — tears down everything
  // ---------------------------------------------------------------------------
  const closeConversation = useCallback(() => {
    closedRef.current = true
    clearTimers()

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null

    if (persistentStreamRef.current) {
      persistentStreamRef.current.getTracks().forEach((t) => t.stop())
      persistentStreamRef.current = null
    }
    analyser.stop()

    isCapturingRef.current = false
    calibratedRef.current = false
    isProcessingRef.current = false
    audioQueueRef.current = []
    conversationRef.current = []
    setState('hidden')
    setElapsed(0)
    setMessages([])
    setIsStreaming(false)
  }, [clearTimers, analyser])

  // ---------------------------------------------------------------------------
  // Process a single audio blob (transcribe -> stream LLM response)
  // ---------------------------------------------------------------------------
  const processAudio = useCallback(
    async (blob: Blob) => {
      if (closedRef.current) return

      // Skip tiny blobs — almost certainly noise/silence, not worth sending to Whisper
      if (blob.size < MIN_AUDIO_BYTES) {
        if (audioQueueRef.current.length > 0) {
          processAudio(audioQueueRef.current.shift()!)
        }
        return
      }

      isProcessingRef.current = true
      setState('transcribing')

      try {
        const formData = new FormData()
        formData.append('audio', blob, 'recording.webm')
        formData.append('format', 'webm')

        const res = await fetch('/api/voice/transcribe', {
          method: 'POST',
          body: formData,
        })
        if (closedRef.current) return

        if (!res.ok) throw new Error(`Transcribe error: ${res.status}`)
        const { text } = await res.json()
        if (closedRef.current) return

        const trimmedText = (text ?? '').trim()

        // Empty — skip
        if (!trimmedText) {
          console.debug('[voice] Empty transcription, skipping')
          isProcessingRef.current = false
          if (audioQueueRef.current.length > 0) {
            processAudio(audioQueueRef.current.shift()!)
          } else {
            // Go back to recording so user can speak again
            setState(conversationRef.current.length > 0 ? 'responding' : 'recording')
          }
          return
        }

        // Close phrases
        if (isCloseCommand(trimmedText)) {
          closeConversation()
          return
        }

        // Filter out noise, hallucinations, and filler words
        if (isNoiseTranscription(trimmedText)) {
          isProcessingRef.current = false
          if (audioQueueRef.current.length > 0) {
            processAudio(audioQueueRef.current.shift()!)
          } else if (conversationRef.current.length > 0) {
            setState('responding')
          }
          return
        }

        const actualMessage = trimmedText

        // Add user message to conversation thread
        setMessages((prev) => [...prev, { role: 'user', content: actualMessage }])
        setState('responding')
        setIsStreaming(true)

        // Add empty assistant message (will be filled by tokens)
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

        // Save to chat panel
        addMessage('user', actualMessage)
        const assistantMsg = addMessage('assistant', '')
        assistantMsgIdRef.current = assistantMsg.id

        conversationRef.current.push({ role: 'user', content: actualMessage })
        assistantContentRef.current = ''

        await streamChat([...conversationRef.current], {
          onToken: (token) => {
            if (closedRef.current) return
            assistantContentRef.current += token
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = { ...last, content: last.content + token }
              }
              return updated
            })
            if (assistantMsgIdRef.current) {
              appendToMessage(assistantMsgIdRef.current, token)
            }
          },
          onDone: () => {
            if (closedRef.current) return
            setIsStreaming(false)
            if (assistantMsgIdRef.current) {
              updateMessage(assistantMsgIdRef.current, { isStreaming: false })
            }
            if (assistantContentRef.current) {
              conversationRef.current.push({ role: 'assistant', content: assistantContentRef.current })
            }
            isProcessingRef.current = false
            if (audioQueueRef.current.length > 0) {
              processAudio(audioQueueRef.current.shift()!)
            }
          },
          onError: (error) => {
            if (closedRef.current) return
            setIsStreaming(false)
            const errMsg = error.message || 'Something went wrong.'
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = { ...last, content: errMsg }
              }
              return updated
            })
            if (assistantMsgIdRef.current) {
              updateMessage(assistantMsgIdRef.current, { content: errMsg, isStreaming: false })
            }
            isProcessingRef.current = false
            if (audioQueueRef.current.length > 0) {
              processAudio(audioQueueRef.current.shift()!)
            }
          },
        })
      } catch (err) {
        if (closedRef.current) return
        console.error('[voice] processAudio error:', err)
        isProcessingRef.current = false

        // Show error to user so the conversation doesn't silently hang
        const errMsg = err instanceof Error ? err.message : 'Transcription failed'
        if (errMsg.includes('500') || errMsg.includes('Transcribe error')) {
          setMessages((prev) => [...prev, { role: 'assistant', content: `⚠ Could not transcribe audio. Please try again.` }])
        }

        if (audioQueueRef.current.length > 0) {
          processAudio(audioQueueRef.current.shift()!)
        } else if (conversationRef.current.length > 0) {
          setState('responding')
        } else {
          setState('recording')
        }
      }
    },
    [isCloseCommand, closeConversation, addMessage, appendToMessage, updateMessage],
  )

  // ---------------------------------------------------------------------------
  // Start capturing one utterance (new MediaRecorder on persistent stream)
  // ---------------------------------------------------------------------------
  const startCapture = useCallback(() => {
    const stream = persistentStreamRef.current
    if (!stream || isCapturingRef.current || closedRef.current) return

    chunksRef.current = []
    isCapturingRef.current = true

    // Show recording UI — keep existing messages visible
    setState('recording')
    setElapsed(0)

    const mediaRecorder = new MediaRecorder(stream)
    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    mediaRecorder.onstop = () => {
      isCapturingRef.current = false
      mediaRecorderRef.current = null
      clearTimers()

      const chunks = chunksRef.current
      chunksRef.current = []

      if (chunks.length === 0) return

      const blob = new Blob(chunks, { type: 'audio/webm' })

      if (isProcessingRef.current) {
        audioQueueRef.current.push(blob)
        return
      }

      processAudio(blob)
    }

    mediaRecorder.start()

    elapsedTimerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1_000)

    hardTimeoutRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }, HARD_TIMEOUT_MS)
  }, [clearTimers, processAudio])

  // ---------------------------------------------------------------------------
  // Open conversation — opens persistent mic
  // When triggered by wake word: wait for silence then next speech (avoids
  //   transcribing "Hey Jarvis" itself).
  // When triggered manually (mic click): start recording immediately.
  // ---------------------------------------------------------------------------
  const openConversation = useCallback(async (fromWakeWord = false) => {
    closedRef.current = false
    setState('recording')
    setElapsed(0)
    setMessages([])

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      if (closedRef.current) return
      persistentStreamRef.current = stream
      analyser.start(stream)

      if (fromWakeWord) {
        // Wake word uses a separate mic stream, so "Hey Jarvis" audio never
        // reaches this MediaRecorder. Mark calibrated immediately so the
        // speech detection effect starts capture as soon as sound is detected.
        calibratedRef.current = true
        return
      }

      // Manual activation: start recording immediately
      calibratedRef.current = true
      chunksRef.current = []
      isCapturingRef.current = true

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        isCapturingRef.current = false
        mediaRecorderRef.current = null
        clearTimers()

        const chunks = chunksRef.current
        chunksRef.current = []

        if (chunks.length === 0) {
          if (conversationRef.current.length === 0) {
            closeConversation()
          }
          return
        }

        const blob = new Blob(chunks, { type: 'audio/webm' })

        if (isProcessingRef.current) {
          audioQueueRef.current.push(blob)
          return
        }

        processAudio(blob)
      }

      mediaRecorder.start()

      elapsedTimerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1)
      }, 1_000)

      hardTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
      }, HARD_TIMEOUT_MS)
    } catch (err) {
      console.error('Mic access failed:', err)
      closeConversation()
    }
  }, [analyser, clearTimers, closeConversation, processAudio])

  // ---------------------------------------------------------------------------
  // Silence detection -> stop current capture
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (
      isCapturingRef.current &&
      analyser.isSilent &&
      mediaRecorderRef.current?.state === 'recording'
    ) {
      mediaRecorderRef.current.stop()
    }
  }, [analyser.isSilent])

  // ---------------------------------------------------------------------------
  // Calibration: mark ready after first silence
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!calibratedRef.current && analyser.isSilent && state !== 'hidden') {
      calibratedRef.current = true
    }
  }, [analyser.isSilent, state])

  // ---------------------------------------------------------------------------
  // Speech detection -> auto-start new capture when not busy
  // Only capture during 'recording' (idle-waiting) or 'responding' when done streaming.
  // Prevents mic from picking up ambient audio / TTS feedback during LLM response.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (
      calibratedRef.current &&
      !isCapturingRef.current &&
      !isProcessingRef.current &&
      !isStreaming &&
      !analyser.isSilent &&
      state !== 'hidden' &&
      state !== 'transcribing' &&
      persistentStreamRef.current
    ) {
      startCapture()
    }
  }, [analyser.isSilent, state, isStreaming, startCapture])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleCancel = useCallback(() => {
    chunksRef.current = []
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const handleClick = useCallback(() => {
    if (state === 'hidden') {
      openConversation()
    } else if (state === 'recording') {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [state, openConversation])

  // ---------------------------------------------------------------------------
  // Wake word: keep openConversationRef in sync
  // ---------------------------------------------------------------------------
  useEffect(() => {
    openConversationRef.current = openConversation
  }, [openConversation])

  // ---------------------------------------------------------------------------
  // Wake word: start/stop listening based on settings and conversation state
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!wakeWordEnabled) {
      openWakeWord.stop()
      webSpeechWakeWord.stop()
      return
    }

    if (state === 'hidden') {
      // Try openWakeWord first, fall back to Web Speech API
      openWakeWord.start().catch(() => {
        // openWakeWord unavailable, try Web Speech API
        if (webSpeechWakeWord.isSupported) {
          webSpeechWakeWord.start()
        }
      })
    } else {
      // Pause wake word during active conversation
      openWakeWord.stop()
      webSpeechWakeWord.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeWordEnabled, state])

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      closedRef.current = true
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.onstop = null
        mediaRecorderRef.current.stop()
      }
      if (persistentStreamRef.current) {
        persistentStreamRef.current.getTracks().forEach((t) => t.stop())
      }
      openWakeWord.stop()
      webSpeechWakeWord.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const isActive = state !== 'hidden'
  const isRecording = state === 'recording'
  const isListening = isActive && !isRecording

  return {
    state,
    elapsed,
    messages,
    isStreaming,
    frequencyData: analyser.frequencyData,
    wakeWordEnabled,
    isActive,
    isRecording,
    isListening,
    openConversation,
    closeConversation,
    startCapture,
    handleCancel,
    handleClick,
    toggleWakeWord,
  }
}
