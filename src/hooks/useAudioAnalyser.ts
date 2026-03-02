import { useState, useCallback, useRef, useEffect } from 'react'

export interface UseAudioAnalyserOptions {
  silenceThreshold?: number   // RMS threshold (0-255 scale), default 10
  silenceDuration?: number    // ms of silence before isSilent=true, default 2500
  fftSize?: number            // default 64 (32 frequency bars)
}

export interface UseAudioAnalyserReturn {
  frequencyData: Uint8Array
  isSilent: boolean
  start: (stream: MediaStream) => void
  stop: () => void
}

const EMPTY_DATA = new Uint8Array(0)

export function useAudioAnalyser({
  silenceThreshold = 10,
  silenceDuration = 2500,
  fftSize = 64,
}: UseAudioAnalyserOptions = {}): UseAudioAnalyserReturn {
  const [frequencyData, setFrequencyData] = useState<Uint8Array>(EMPTY_DATA)
  const [isSilent, setIsSilent] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const silenceSinceRef = useRef<number | null>(null)

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect()
      analyserRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    silenceSinceRef.current = null
    setFrequencyData(EMPTY_DATA)
    setIsSilent(false)
  }, [])

  const start = useCallback((stream: MediaStream) => {
    // Clean up any previous session
    cleanup()

    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = fftSize
    analyser.smoothingTimeConstant = 0.8

    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)

    audioContextRef.current = audioContext
    analyserRef.current = analyser
    sourceRef.current = source
    silenceSinceRef.current = null

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const tick = () => {
      if (!analyserRef.current) return

      analyserRef.current.getByteFrequencyData(dataArray)

      // Copy so React sees a new reference on each tick
      setFrequencyData(new Uint8Array(dataArray))

      // Compute RMS over the frequency bins
      let sumSquares = 0
      for (let i = 0; i < bufferLength; i++) {
        sumSquares += dataArray[i] * dataArray[i]
      }
      const rms = Math.sqrt(sumSquares / bufferLength)

      const now = performance.now()

      if (rms < silenceThreshold) {
        if (silenceSinceRef.current === null) {
          silenceSinceRef.current = now
        }
        if (now - silenceSinceRef.current >= silenceDuration) {
          setIsSilent(true)
        }
      } else {
        silenceSinceRef.current = null
        setIsSilent(false)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [fftSize, silenceThreshold, silenceDuration, cleanup])

  const stop = useCallback(() => {
    cleanup()
  }, [cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return { frequencyData, isSilent, start, stop }
}
