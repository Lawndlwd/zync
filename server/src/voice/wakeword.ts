import { spawn, type ChildProcess } from 'child_process'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { logger } from '../lib/logger.js'

let wakewordProcess: ChildProcess | null = null

export function startWakeWordServer(): void {
  // Read env at call time (after dotenv has loaded)
  if (process.env.WAKEWORD_ENABLED !== 'true') return

  const wakewordDir = resolve(import.meta.dirname, '../../wakeword')
  const venvPython = resolve(wakewordDir, '.venv/bin/python3')
  const python = existsSync(venvPython) ? venvPython : 'python3'

  const serverScript = resolve(wakewordDir, 'server.py')
  if (!existsSync(serverScript)) {
    logger.info({ path: serverScript }, '[wakeword] server.py not found, skipping')
    return
  }

  // Check if openwakeword is installed
  const check = spawn(python, ['-c', 'import openwakeword'], { stdio: 'pipe' })
  check.on('close', (code) => {
    if (code !== 0) {
      logger.info('[wakeword] openwakeword not installed. Run: cd server/wakeword && .venv/bin/pip install -r requirements.txt')
      return
    }

    logger.info(`[wakeword] Starting Python sidecar (${python})...`)
    wakewordProcess = spawn(python, [serverScript], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        WAKEWORD_PORT: process.env.WAKEWORD_PORT || '9000',
        WAKEWORD_MODEL: process.env.WAKEWORD_MODEL || 'hey_jarvis',
        WAKEWORD_THRESHOLD: process.env.WAKEWORD_THRESHOLD || '0.5',
      },
    })

    wakewordProcess.stdout?.on('data', (data: Buffer) => {
      logger.info(`[wakeword] ${data.toString().trim()}`)
    })

    wakewordProcess.stderr?.on('data', (data: Buffer) => {
      logger.error(`[wakeword] ${data.toString().trim()}`)
    })

    wakewordProcess.on('close', (code) => {
      logger.info(`[wakeword] Process exited with code ${code}`)
      wakewordProcess = null
    })

    wakewordProcess.on('error', (err) => {
      logger.error({ err }, '[wakeword] Failed to start')
      wakewordProcess = null
    })
  })
}

export function stopWakeWordServer(): void {
  if (wakewordProcess) {
    wakewordProcess.kill()
    wakewordProcess = null
  }
}
