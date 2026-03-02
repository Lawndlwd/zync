import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

const WHISPER_PATH = process.env.WHISPER_PATH || '/opt/homebrew/opt/whisper-cpp/bin/whisper-cli'
const WHISPER_MODEL = process.env.WHISPER_MODEL || resolve(import.meta.dirname, '../../data/ggml-base.en.bin')
const TEMP_DIR = process.env.TEMP_DIR || '/tmp'

// Formats whisper-cpp supports natively
const NATIVE_FORMATS = new Set(['flac', 'mp3', 'ogg', 'wav'])

async function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-i', inputPath,
    '-ar', '16000',    // 16kHz sample rate (what whisper expects)
    '-ac', '1',        // mono
    '-y',              // overwrite
    outputPath,
  ], { timeout: 30_000 })
}

export async function transcribeAudio(audioBuffer: Buffer, format = 'ogg'): Promise<string> {
  const id = randomUUID()
  const tempInput = resolve(TEMP_DIR, `whisper-${id}.${format}`)
  const tempWav = resolve(TEMP_DIR, `whisper-${id}.wav`)
  const tempOutputBase = resolve(TEMP_DIR, `whisper-${id}`)
  const tempOutput = `${tempOutputBase}.txt`

  try {
    writeFileSync(tempInput, audioBuffer)

    // Convert to wav if format isn't natively supported
    const whisperInput = NATIVE_FORMATS.has(format) ? tempInput : tempWav
    if (!NATIVE_FORMATS.has(format)) {
      await convertToWav(tempInput, tempWav)
    }

    const args = [
      '--model', WHISPER_MODEL,
      '--file', whisperInput,
      '--output-txt',
      '--output-file', tempOutputBase,
      '--no-timestamps',
    ]

    await execFileAsync(WHISPER_PATH, args, { timeout: 60_000 })

    if (!existsSync(tempOutput)) {
      throw new Error('Whisper output file not found')
    }

    return readFileSync(tempOutput, 'utf-8').trim()
  } finally {
    try { unlinkSync(tempInput) } catch {}
    try { unlinkSync(tempWav) } catch {}
    try { unlinkSync(tempOutput) } catch {}
  }
}

export async function transcribeFromUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  return transcribeAudio(buffer)
}
