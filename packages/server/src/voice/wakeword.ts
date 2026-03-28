import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getConfig } from '../config/index.js'
import { logger } from '../lib/logger.js'

let wakewordProcess: ChildProcess | null = null

export function startWakeWordServer(): void {
  // Read config at call time (after dotenv has loaded)
  if (getConfig('WAKEWORD_ENABLED') !== 'true') return

  const wakewordDir = resolve(import.meta.dirname, '../../wakeword')
  const venvPython = resolve(wakewordDir, '.venv/bin/python3')
  const python = existsSync(venvPython) ? venvPython : 'python3'

  const serverScript = resolve(wakewordDir, 'server.py')
  if (!existsSync(serverScript)) {
    logger.info({ path: serverScript }, '[wakeword] server.py not found, skipping')
    return
  }

  // Check if openwakeword is installed
  const check = spawnSync(python, ['-c', 'import openwakeword'], { stdio: 'pipe' })
  if (check.status !== 0) {
    logger.info(
      '[wakeword] openwakeword not installed. Run: cd server/wakeword && .venv/bin/pip install -r requirements.txt',
    )
    return
  }

  logger.info(`[wakeword] Starting Python sidecar (${python})...`)
  wakewordProcess = spawn(python, [serverScript], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      WAKEWORD_PORT: getConfig('WAKEWORD_PORT', '9000') || '9000',
      WAKEWORD_MODEL: getConfig('WAKEWORD_MODEL', 'hey_jarvis') || 'hey_jarvis',
      WAKEWORD_THRESHOLD: getConfig('WAKEWORD_THRESHOLD', '0.5') || '0.5',
    },
  })

  wakewordProcess.stdout?.on('data', (data: Buffer) => {
    logger.info(`[wakeword] ${data.toString().trim()}`)
  })

  wakewordProcess.stderr?.on('data', (data: Buffer) => {
    logger.error(`[wakeword] ${data.toString().trim()}`)
  })

  wakewordProcess.on('close', (code: number | null) => {
    logger.info(`[wakeword] Process exited with code ${code}`)
    wakewordProcess = null
  })

  wakewordProcess.on('error', (err: Error) => {
    logger.error({ err }, '[wakeword] Failed to start')
    wakewordProcess = null
  })
}

export function stopWakeWordServer(): void {
  if (wakewordProcess) {
    wakewordProcess.kill()
    wakewordProcess = null
  }
}
