import { useState, useCallback, useRef } from 'react'

// Module-level refs — shared across hook instances, survive re-renders
let modelPromise: Promise<KokoroModel> | null = null
let model: KokoroModel | null = null

interface KokoroModel {
  generate: (text: string, options?: { voice?: string }) => Promise<{ toWav: () => ArrayBuffer }>
  stream: (text: string, options?: { voice?: string; split_pattern?: RegExp }) => AsyncIterable<{ toWav: () => ArrayBuffer }>
}

interface UseKokoroTTSReturn {
  speak: (text: string, voice?: string) => Promise<void>
  stop: () => void
  isSpeaking: boolean
  isLoading: boolean
  isAvailable: boolean
  loadingProgress: number
}

async function loadModel(onProgress: (p: number) => void): Promise<KokoroModel> {
  if (model) return model

  if (!modelPromise) {
    modelPromise = (async () => {
      const { KokoroTTS } = await import('kokoro-js')
      const instance = await KokoroTTS.from_pretrained(
        'onnx-community/Kokoro-82M-v1.0-ONNX',
        {
          dtype: 'q8',
          device: 'wasm',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          progress_callback: (progress: any) => {
            if (progress?.progress != null) {
              onProgress(Math.round(progress.progress))
            }
          },
        },
      )
      model = instance as unknown as KokoroModel
      return model
    })()
  }

  return modelPromise
}

export function useKokoroTTS(): UseKokoroTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [isAvailable, setIsAvailable] = useState(true)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const abortRef = useRef(false)

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext()
    }
    return audioCtxRef.current
  }, [])

  const stop = useCallback(() => {
    abortRef.current = true
    if (sourceRef.current) {
      try {
        sourceRef.current.stop()
        sourceRef.current.disconnect()
      } catch {
        // already stopped
      }
      sourceRef.current = null
    }
    setIsSpeaking(false)
  }, [])

  const playWav = useCallback(
    async (wavBuffer: ArrayBuffer): Promise<void> => {
      const ctx = getAudioContext()
      const audioBuffer = await ctx.decodeAudioData(wavBuffer.slice(0))
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)
      sourceRef.current = source

      return new Promise<void>((resolve) => {
        source.onended = () => {
          sourceRef.current = null
          resolve()
        }
        source.start()
      })
    },
    [getAudioContext],
  )

  const speak = useCallback(
    async (text: string, voice?: string) => {
      if (!text.trim()) return

      stop()
      abortRef.current = false
      setIsLoading(true)

      try {
        const tts = await loadModel((p) => setLoadingProgress(p))
        setIsLoading(false)

        if (abortRef.current) return
        setIsSpeaking(true)

        // Use streaming for long text, direct generate for short
        const isLong = text.length > 200
        if (isLong) {
          for await (const chunk of tts.stream(text, {
            voice: voice ?? 'af_heart',
            split_pattern: /[.!?]+/,
          })) {
            if (abortRef.current) break
            await playWav(chunk.toWav())
          }
        } else {
          const result = await tts.generate(text, { voice: voice ?? 'af_heart' })
          if (!abortRef.current) {
            await playWav(result.toWav())
          }
        }
      } catch (err) {
        console.error('Kokoro TTS error:', err)
        setIsAvailable(false)
      } finally {
        setIsLoading(false)
        setIsSpeaking(false)
      }
    },
    [stop, playWav],
  )

  return { speak, stop, isSpeaking, isLoading, isAvailable, loadingProgress }
}
