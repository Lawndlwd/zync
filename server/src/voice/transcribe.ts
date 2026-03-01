import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

const WHISPER_PATH = process.env.WHISPER_PATH || 'whisper-cli'
const WHISPER_MODEL = process.env.WHISPER_MODEL || resolve(import.meta.dirname, '../../data/ggml-base.en.bin')
const TEMP_DIR = process.env.TEMP_DIR || '/tmp'

export async function transcribeAudio(audioBuffer: Buffer, format = 'ogg'): Promise<string> {
  const id = randomUUID()
  const tempInput = resolve(TEMP_DIR, `whisper-${id}.${format}`)
  const tempOutputBase = resolve(TEMP_DIR, `whisper-${id}`)
  const tempOutput = `${tempOutputBase}.txt`

  try {
    writeFileSync(tempInput, audioBuffer)

    const args = [
      '--model', WHISPER_MODEL,
      '--file', tempInput,
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
    try { unlinkSync(tempOutput) } catch {}
  }
}

export async function transcribeFromUrl(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download audio: ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  return transcribeAudio(buffer)
}
