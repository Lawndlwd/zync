import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs'
import { resolve, basename, dirname } from 'path'
import { randomUUID } from 'crypto'
import { logger } from '../lib/logger.js'
import { getConfig } from '../config/index.js'

const execFileAsync = promisify(execFile)

// Whisper microservice URL (preferred in Docker)
const WHISPER_SERVICE_URL = getConfig('WHISPER_SERVICE_URL') || ''

// faster-whisper (whisper-ctranslate2) settings (local fallback)
const FASTER_WHISPER_PATH = getConfig('FASTER_WHISPER_PATH', 'whisper-ctranslate2') || 'whisper-ctranslate2'
const FASTER_WHISPER_MODEL = getConfig('FASTER_WHISPER_MODEL', 'base.en') || 'base.en'

const TEMP_DIR = getConfig('TEMP_DIR', '/tmp') || '/tmp'

// Detected backend (resolved once at startup)
let resolvedBackend: 'service' | 'faster-whisper' | null = null

async function detectBackend(): Promise<'service' | 'faster-whisper'> {
  if (resolvedBackend) return resolvedBackend

  // Try whisper microservice first
  if (WHISPER_SERVICE_URL) {
    try {
      const res = await fetch(`${WHISPER_SERVICE_URL}/health`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        resolvedBackend = 'service'
        logger.info({ url: WHISPER_SERVICE_URL }, '[transcribe] Using whisper microservice')
        return resolvedBackend
      }
    } catch {
      logger.warn('[transcribe] Whisper service configured but unreachable, falling back to local')
    }
  }

  // Verify faster-whisper is installed
  try {
    await execFileAsync(FASTER_WHISPER_PATH, ['--help'], { timeout: 5_000 })
    resolvedBackend = 'faster-whisper'
    logger.info('[transcribe] Using faster-whisper backend')
  } catch {
    throw new Error(
      'faster-whisper (whisper-ctranslate2) is not installed. ' +
      'Install it with: pip install whisper-ctranslate2'
    )
  }

  return resolvedBackend
}

async function transcribeViaService(audioBuffer: Buffer, format: string): Promise<string> {
  const formData = new FormData()
  formData.append('audio', new Blob([new Uint8Array(audioBuffer)]), `audio.${format}`)
  formData.append('format', format)

  const res = await fetch(`${WHISPER_SERVICE_URL}/transcribe`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(`Whisper service error: ${body.error || res.statusText}`)
  }

  const data = await res.json() as { text: string }
  return data.text
}

async function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-i', inputPath,
    '-ar', '16000',    // 16kHz sample rate (what whisper expects)
    '-ac', '1',        // mono
    '-y',              // overwrite
    outputPath,
  ], { timeout: 30_000 })
}

async function transcribeWithFasterWhisper(wavPath: string): Promise<string> {
  const outputDir = dirname(wavPath)
  const args = [
    wavPath,
    '--model', FASTER_WHISPER_MODEL,
    '--output_format', 'txt',
    '--output_dir', outputDir,
    '--language', 'en',
    '--beam_size', '1',
    '--compute_type', 'int8',
  ]

  await execFileAsync(FASTER_WHISPER_PATH, args, { timeout: 60_000 })

  // whisper-ctranslate2 creates <input_stem>.txt in output_dir
  const stem = basename(wavPath).replace(/\.[^.]+$/, '')
  const outputFile = resolve(outputDir, `${stem}.txt`)
  if (!existsSync(outputFile)) {
    throw new Error('faster-whisper output file not found')
  }

  return readFileSync(outputFile, 'utf-8').trim()
}

export async function transcribeAudio(audioBuffer: Buffer, format = 'ogg'): Promise<string> {
  const backend = await detectBackend()

  // Use whisper microservice if available — no temp files needed
  if (backend === 'service') {
    return transcribeViaService(audioBuffer, format)
  }

  const id = randomUUID()
  const tempInput = resolve(TEMP_DIR, `whisper-${id}.${format}`)
  const tempWav = resolve(TEMP_DIR, `whisper-${id}.wav`)

  const tempFiles = [tempInput, tempWav]

  try {
    writeFileSync(tempInput, audioBuffer)

    await convertToWav(tempInput, tempWav)

    const stem = basename(tempWav).replace(/\.[^.]+$/, '')
    tempFiles.push(resolve(dirname(tempWav), `${stem}.txt`))
    return await transcribeWithFasterWhisper(tempWav)
  } finally {
    for (const f of tempFiles) {
      try { unlinkSync(f) } catch {}
    }
  }
}

export async function transcribeFromUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  return transcribeAudio(buffer)
}
