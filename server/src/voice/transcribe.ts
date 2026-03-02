import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs'
import { resolve, basename, dirname } from 'path'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

// Whisper-cpp settings
const WHISPER_PATH = process.env.WHISPER_PATH || '/opt/homebrew/opt/whisper-cpp/bin/whisper-cli'
const WHISPER_MODEL = process.env.WHISPER_MODEL || resolve(import.meta.dirname, '../../data/ggml-base.en.bin')

// faster-whisper (whisper-ctranslate2) settings
const WHISPER_BACKEND = process.env.WHISPER_BACKEND || 'auto'
const FASTER_WHISPER_PATH = process.env.FASTER_WHISPER_PATH || 'whisper-ctranslate2'
const FASTER_WHISPER_MODEL = process.env.FASTER_WHISPER_MODEL || 'base.en'

const TEMP_DIR = process.env.TEMP_DIR || '/tmp'

// Formats whisper-cpp supports natively
const NATIVE_FORMATS = new Set(['flac', 'mp3', 'ogg', 'wav'])

// Detected backend (resolved once at startup)
let resolvedBackend: 'faster-whisper' | 'whisper-cpp' | null = null

async function detectBackend(): Promise<'faster-whisper' | 'whisper-cpp'> {
  if (resolvedBackend) return resolvedBackend

  if (WHISPER_BACKEND === 'whisper-cpp') {
    resolvedBackend = 'whisper-cpp'
    return resolvedBackend
  }

  if (WHISPER_BACKEND === 'faster-whisper') {
    resolvedBackend = 'faster-whisper'
    return resolvedBackend
  }

  // Auto-detect: try faster-whisper first
  try {
    await execFileAsync(FASTER_WHISPER_PATH, ['--help'], { timeout: 5_000 })
    resolvedBackend = 'faster-whisper'
    console.log('[transcribe] Using faster-whisper backend')
  } catch {
    resolvedBackend = 'whisper-cpp'
    console.log('[transcribe] Using whisper-cpp backend (faster-whisper not found)')
  }

  return resolvedBackend
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

async function transcribeWithWhisperCpp(wavPath: string, outputBase: string): Promise<string> {
  const args = [
    '--model', WHISPER_MODEL,
    '--file', wavPath,
    '--output-txt',
    '--output-file', outputBase,
    '--no-timestamps',
  ]

  await execFileAsync(WHISPER_PATH, args, { timeout: 60_000 })

  const outputFile = `${outputBase}.txt`
  if (!existsSync(outputFile)) {
    throw new Error('Whisper output file not found')
  }

  return readFileSync(outputFile, 'utf-8').trim()
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
  const id = randomUUID()
  const tempInput = resolve(TEMP_DIR, `whisper-${id}.${format}`)
  const tempWav = resolve(TEMP_DIR, `whisper-${id}.wav`)
  const tempOutputBase = resolve(TEMP_DIR, `whisper-${id}`)

  // Track files to clean up
  const tempFiles = [tempInput, tempWav]

  try {
    writeFileSync(tempInput, audioBuffer)

    // Always convert to WAV for consistency (both backends need 16kHz mono)
    const whisperInput = NATIVE_FORMATS.has(format) && backend === 'whisper-cpp' ? tempInput : tempWav
    if (whisperInput === tempWav) {
      await convertToWav(tempInput, tempWav)
    }

    if (backend === 'faster-whisper') {
      // faster-whisper creates its own output file
      const stem = basename(whisperInput).replace(/\.[^.]+$/, '')
      tempFiles.push(resolve(dirname(whisperInput), `${stem}.txt`))
      return await transcribeWithFasterWhisper(whisperInput)
    } else {
      tempFiles.push(`${tempOutputBase}.txt`)
      return await transcribeWithWhisperCpp(whisperInput, tempOutputBase)
    }
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
