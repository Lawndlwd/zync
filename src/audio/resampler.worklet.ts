/**
 * AudioWorkletProcessor that resamples audio from the native sample rate
 * (typically 48kHz or 44.1kHz) down to 16kHz 16-bit mono PCM.
 *
 * Posts 1280-sample (2560-byte) Int16 frames to the main thread,
 * matching openWakeWord's expected input format.
 */

// AudioWorklet globals — these exist in the worklet scope, not the main thread
declare class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor()
}
declare function registerProcessor(name: string, ctor: typeof AudioWorkletProcessor): void
declare const sampleRate: number

const TARGET_RATE = 16000
const FRAME_SIZE = 1280 // samples per frame (80ms at 16kHz)

class ResamplerWorklet extends AudioWorkletProcessor {
  private buffer: number[] = []
  private ratio: number = 0

  constructor() {
    super()
    // sampleRate is a global in AudioWorkletGlobalScope
    this.ratio = sampleRate / TARGET_RATE
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0]
    if (!input || input.length === 0) return true

    // Linear interpolation resampling from native rate to 16kHz
    const outputLength = Math.floor(input.length / this.ratio)
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * this.ratio
      const idx = Math.floor(srcIndex)
      const frac = srcIndex - idx
      const s0 = input[idx] ?? 0
      const s1 = input[Math.min(idx + 1, input.length - 1)] ?? 0
      this.buffer.push(s0 + frac * (s1 - s0))
    }

    // Send complete frames
    while (this.buffer.length >= FRAME_SIZE) {
      const frame = this.buffer.splice(0, FRAME_SIZE)
      const int16 = new Int16Array(FRAME_SIZE)
      for (let i = 0; i < FRAME_SIZE; i++) {
        // Clamp and convert float [-1, 1] to int16 [-32768, 32767]
        const s = Math.max(-1, Math.min(1, frame[i]))
        int16[i] = s < 0 ? s * 32768 : s * 32767
      }
      this.port.postMessage(int16.buffer, [int16.buffer])
    }

    return true
  }
}

registerProcessor('resampler-worklet', ResamplerWorklet)
