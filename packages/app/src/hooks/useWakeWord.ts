import { useState, useEffect, useCallback, useRef } from 'react'

interface UseWakeWordOptions {
  phrase?: string
  onDetected: () => void
  enabled?: boolean
}

const MAX_FATAL_ERRORS = 5
const BASE_RETRY_MS = 500
const MAX_RETRY_MS = 10_000
// Transient errors that should be retried with backoff
const TRANSIENT_ERRORS = new Set(['network', 'service-not-allowed', 'audio-capture'])

export function useWakeWord({ phrase = 'ok zinc', onDetected, enabled: _enabled = true }: UseWakeWordOptions) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const detectedRef = useRef(false)
  const enabledRef = useRef(_enabled)
  const failCountRef = useRef(0)

  // Keep enabledRef in sync with the enabled prop
  useEffect(() => {
    enabledRef.current = _enabled
  }, [_enabled])

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)
  }, [])

  const start = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    // Stop any existing recognition instance first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
      } catch {
        // ignore errors when stopping existing instance
      }
      recognitionRef.current = null
    }

    detectedRef.current = false
    failCountRef.current = 0
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      if (detectedRef.current) return
      // Reset fail counter on successful speech result
      failCountRef.current = 0
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim()
        if (transcript.includes(phrase)) {
          detectedRef.current = true
          recognition.stop()
          onDetected()
          return
        }
      }
    }

    recognition.onend = () => {
      // Use enabledRef for current value (avoids stale closure)
      if (recognitionRef.current && !detectedRef.current && enabledRef.current) {
        // Exponential backoff based on fail count
        const delay = Math.min(BASE_RETRY_MS * Math.pow(2, failCountRef.current), MAX_RETRY_MS)
        setTimeout(() => {
          if (recognitionRef.current && !detectedRef.current && enabledRef.current) {
            try { recognition.start() } catch {}
          }
        }, delay)
      } else {
        setIsListening(false)
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return

      if (TRANSIENT_ERRORS.has(event.error)) {
        // Transient errors: increment counter but let onend retry with backoff
        failCountRef.current += 1
        console.warn(`Wake word: transient "${event.error}" (attempt ${failCountRef.current})`)
        return
      }

      // True fatal errors (not-allowed, language-not-supported, etc.)
      failCountRef.current += 1
      console.error('Wake word error:', event.error)

      if (failCountRef.current >= MAX_FATAL_ERRORS) {
        console.error(`Wake word: ${MAX_FATAL_ERRORS} consecutive errors, stopping.`)
        recognitionRef.current = null
        setIsListening(false)
      }
    }

    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
  }, [phrase, onDetected])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  const resume = useCallback(() => {
    detectedRef.current = false
    if (enabledRef.current) {
      start()
    }
  }, [start])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    }
  }, [])

  return { isListening, isSupported, start, stop, resume }
}
