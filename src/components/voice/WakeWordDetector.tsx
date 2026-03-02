import { useState, useCallback, useRef, useEffect } from 'react'
import { useWakeWord } from '@/hooks/useWakeWord'
import { useAudioAnalyser } from '@/hooks/useAudioAnalyser'
import { VoicePill, type VoiceState } from './VoicePill'
import { streamChat, type LLMMessage } from '@/services/llm'
import { Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'

const HARD_TIMEOUT_MS = 15_000
const AUTO_DISMISS_MS = 8_000
const ERROR_DISMISS_MS = 4_000

export function WakeWordDetector() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [enabled, setEnabled] = useState(false)
  const [state, setState] = useState<VoiceState>('hidden')
  const [elapsed, setElapsed] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Forward reference for wake word controls (needed because startRecording
  // is passed as onDetected to useWakeWord, creating a circular dependency)
  const wakeWordRef = useRef<{ resume: () => void; start: () => void; stop: () => void }>({
    resume: () => {},
    start: () => {},
    stop: () => {},
  })

  // ---------------------------------------------------------------------------
  // Audio analyser
  // ---------------------------------------------------------------------------
  const analyser = useAudioAnalyser()

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

  const clearAutoDismiss = useCallback(() => {
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current)
      autoDismissRef.current = null
    }
  }, [])

  const resetToHidden = useCallback(() => {
    setState('hidden')
    setElapsed(0)
    setTranscript('')
    setResponse('')
    setIsStreaming(false)
    clearTimers()
    clearAutoDismiss()
  }, [clearTimers, clearAutoDismiss])

  // ---------------------------------------------------------------------------
  // Start recording (called when wake word is detected)
  // ---------------------------------------------------------------------------
  const startRecording = useCallback(async () => {
    // Reset state for new session
    setState('recording')
    setElapsed(0)
    setTranscript('')
    setResponse('')
    setIsStreaming(false)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Start audio analyser for waveform + silence detection
      analyser.start(stream)

      // Create and configure MediaRecorder
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        // Cleanup recording resources
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        mediaRecorderRef.current = null
        analyser.stop()
        clearTimers()

        const chunks = chunksRef.current
        chunksRef.current = []

        // No audio captured
        if (chunks.length === 0) {
          setState('hidden')
          wakeWordRef.current.resume()
          return
        }

        // Transcribe
        setState('transcribing')
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' })
          const formData = new FormData()
          formData.append('audio', blob, 'recording.webm')
          formData.append('format', 'webm')

          const res = await fetch('/api/voice/transcribe', {
            method: 'POST',
            body: formData,
          })

          if (!res.ok) throw new Error(`Transcribe error: ${res.status}`)

          const { text } = await res.json()

          if (!text?.trim()) {
            setState('hidden')
            wakeWordRef.current.resume()
            return
          }

          // Stream LLM response
          const trimmedText = text.trim()
          setTranscript(trimmedText)
          setState('responding')
          setIsStreaming(true)

          const messages: LLMMessage[] = [{ role: 'user', content: trimmedText }]

          streamChat(messages, {
            onToken: (token) => {
              setResponse((prev) => prev + token)
            },
            onDone: () => {
              setIsStreaming(false)
              autoDismissRef.current = setTimeout(() => {
                resetToHidden()
                wakeWordRef.current.resume()
              }, AUTO_DISMISS_MS)
            },
            onError: (error) => {
              setIsStreaming(false)
              setResponse(error.message || 'Something went wrong.')
              autoDismissRef.current = setTimeout(() => {
                resetToHidden()
                wakeWordRef.current.resume()
              }, ERROR_DISMISS_MS)
            },
          })
        } catch {
          setState('hidden')
          wakeWordRef.current.resume()
        }
      }

      // Start recording
      mediaRecorder.start()

      // Elapsed timer (1s ticks)
      elapsedTimerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1)
      }, 1_000)

      // Hard timeout
      hardTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
        }
      }, HARD_TIMEOUT_MS)
    } catch {
      setState('hidden')
      wakeWordRef.current.resume()
    }
  }, [analyser, clearTimers, resetToHidden])

  // ---------------------------------------------------------------------------
  // Silence detection → stop recording
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (
      state === 'recording' &&
      analyser.isSilent &&
      mediaRecorderRef.current?.state === 'recording'
    ) {
      mediaRecorderRef.current.stop()
    }
  }, [state, analyser.isSilent])

  // ---------------------------------------------------------------------------
  // Wake word hook
  // ---------------------------------------------------------------------------
  const wakeWord = useWakeWord({
    onDetected: startRecording,
    enabled,
  })

  // Keep forward ref in sync
  useEffect(() => {
    wakeWordRef.current = {
      resume: wakeWord.resume,
      start: wakeWord.start,
      stop: wakeWord.stop,
    }
  }, [wakeWord.resume, wakeWord.start, wakeWord.stop])

  // Start/stop wake word listening when enabled changes
  useEffect(() => {
    if (enabled) {
      wakeWord.start()
    } else {
      wakeWord.stop()
    }
  }, [enabled, wakeWord.start, wakeWord.stop])

  // ---------------------------------------------------------------------------
  // Cancel (during recording)
  // ---------------------------------------------------------------------------
  const handleCancel = useCallback(() => {
    chunksRef.current = []
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    // onstop will see empty chunks and go to hidden + resume
  }, [])

  // ---------------------------------------------------------------------------
  // Dismiss (during responding)
  // ---------------------------------------------------------------------------
  const handleDismiss = useCallback(() => {
    clearAutoDismiss()
    resetToHidden()
    wakeWordRef.current.resume()
  }, [clearAutoDismiss, resetToHidden])

  // ---------------------------------------------------------------------------
  // Toggle enabled
  // ---------------------------------------------------------------------------
  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      if (!next) {
        // Turning off: clean up everything
        if (mediaRecorderRef.current?.state === 'recording') {
          chunksRef.current = []
          mediaRecorderRef.current.stop()
        }
        resetToHidden()
      }
      return next
    })
  }, [resetToHidden])

  // ---------------------------------------------------------------------------
  // Sidebar button
  // ---------------------------------------------------------------------------
  const isRecording = state === 'recording'
  const isTranscribing = state === 'transcribing'

  const buttonLabel = !enabled
    ? 'Voice Off'
    : isRecording
      ? 'Recording...'
      : isTranscribing
        ? 'Processing...'
        : 'Listening'

  const sidebarButton = (
    <button
      onClick={toggleEnabled}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors w-full',
        !enabled
          ? 'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300'
          : isRecording
            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/15'
            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15'
      )}
    >
      {!enabled ? (
        <MicOff size={20} className="shrink-0" />
      ) : (
        <span className="relative shrink-0">
          <Mic size={20} />
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full',
              isRecording
                ? 'bg-red-500 animate-pulse'
                : 'bg-emerald-500 animate-pulse'
            )}
          />
        </span>
      )}
      <span className="hidden lg:block truncate">{buttonLabel}</span>
    </button>
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      {sidebarButton}
      <VoicePill
        state={state}
        frequencyData={analyser.frequencyData}
        elapsed={elapsed}
        transcript={transcript}
        response={response}
        isStreaming={isStreaming}
        onCancel={handleCancel}
        onDismiss={handleDismiss}
      />
    </>
  )
}
