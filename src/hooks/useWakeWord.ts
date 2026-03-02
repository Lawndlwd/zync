import { useState, useEffect, useCallback, useRef } from 'react'

interface UseWakeWordOptions {
  phrase?: string
  onDetected: () => void
  enabled?: boolean
}

const MAX_CONSECUTIVE_ERRORS = 3
const RESTART_DELAY_MS = 300

export function useWakeWord({ phrase = 'hey claw', onDetected, enabled: _enabled = true }: UseWakeWordOptions) {
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
        // Add delay between restarts to avoid tight loops
        setTimeout(() => {
          if (recognitionRef.current && !detectedRef.current && enabledRef.current) {
            try { recognition.start() } catch {}
          }
        }, RESTART_DELAY_MS)
      } else {
        setIsListening(false)
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      console.error('Wake word error:', event.error)

      failCountRef.current += 1

      // After MAX_CONSECUTIVE_ERRORS fatal errors, stop to avoid infinite loop
      if (failCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
        console.error(`Wake word: ${MAX_CONSECUTIVE_ERRORS} consecutive errors, stopping.`)
        recognitionRef.current = null
        setIsListening(false)
        return
      }

      // For fewer errors, let onend handle the restart
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
