import { useState, useCallback, useRef, useEffect } from 'react'

const DEFAULT_WS_URL = '/ws/wakeword'

interface UseOpenWakeWordOptions {
  wsUrl?: string
  onDetected?: (model: string, score: number) => void
}

interface UseOpenWakeWordReturn {
  isListening: boolean
  isConnected: boolean
  isSupported: boolean
  start: () => Promise<void>
  stop: () => void
  resume: () => Promise<void>
}

export function useOpenWakeWord(options: UseOpenWakeWordOptions = {}): UseOpenWakeWordReturn {
  const { wsUrl = DEFAULT_WS_URL, onDetected } = options

  const [isListening, setIsListening] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const resumeListenerRef = useRef<(() => void) | null>(null)
  const onDetectedRef = useRef(onDetected)

  // Keep callback ref fresh
  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  const cleanup = useCallback(() => {
    if (resumeListenerRef.current) {
      window.removeEventListener('click', resumeListenerRef.current)
      window.removeEventListener('keydown', resumeListenerRef.current)
      window.removeEventListener('touchstart', resumeListenerRef.current)
      resumeListenerRef.current = null
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsListening(false)
    setIsConnected(false)
  }, [])

  const start = useCallback(async () => {
    cleanup()

    // Build absolute WS URL
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const fullUrl = wsUrl.startsWith('ws') ? wsUrl : `${proto}//${window.location.host}${wsUrl}`

    // Connect WebSocket — fail silently if sidecar is not running
    const ws = new WebSocket(fullUrl)
    wsRef.current = ws

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.close()
        reject(new Error('WebSocket connection timeout'))
      }, 3000)
      ws.onopen = () => {
        clearTimeout(timer)
        setIsConnected(true)
        resolve()
      }
      ws.onerror = () => {
        clearTimeout(timer)
        ws.close()
        reject(new Error('Wake word server not reachable'))
      }
    })

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.detected) {
          onDetectedRef.current?.(data.detected, data.score)
        }
      } catch {
        // ignore non-JSON messages
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
    }

    // Get microphone
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream

    // Set up AudioContext + worklet
    const audioCtx = new AudioContext()
    audioCtxRef.current = audioCtx

    // Browser autoplay policy: AudioContext may start suspended without a user gesture.
    // Try to resume it; if still suspended, wait for any user interaction to unblock.
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {})
    }
    if (audioCtx.state === 'suspended') {
      const resumeOnGesture = () => {
        audioCtx.resume()
        window.removeEventListener('click', resumeOnGesture)
        window.removeEventListener('keydown', resumeOnGesture)
        window.removeEventListener('touchstart', resumeOnGesture)
        resumeListenerRef.current = null
      }
      resumeListenerRef.current = resumeOnGesture
      window.addEventListener('click', resumeOnGesture)
      window.addEventListener('keydown', resumeOnGesture)
      window.addEventListener('touchstart', resumeOnGesture)
    }

    const workletUrl = new URL('../audio/resampler.worklet.ts', import.meta.url)
    await audioCtx.audioWorklet.addModule(workletUrl)

    const source = audioCtx.createMediaStreamSource(stream)
    const workletNode = new AudioWorkletNode(audioCtx, 'resampler-worklet')
    workletNodeRef.current = workletNode

    // Forward PCM frames to WebSocket
    workletNode.port.onmessage = (e: MessageEvent) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(e.data as ArrayBuffer)
      }
    }

    source.connect(workletNode)
    // Don't connect workletNode to destination — we don't want playback
    setIsListening(true)
  }, [cleanup, wsUrl])

  const stop = useCallback(() => {
    cleanup()
  }, [cleanup])

  const resume = useCallback(async () => {
    if (!isListening) {
      await start()
    }
  }, [isListening, start])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    isListening,
    isConnected,
    isSupported: true, // WebSocket + AudioWorklet support is widespread
    start,
    stop,
    resume,
  }
}
