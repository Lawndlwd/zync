import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const execFileAsync = promisify(execFile)
const CONFIG_PATH = resolve(import.meta.dirname, '../../../data/tool-config.json')

interface ToolConfig {
  shell: {
    allowlist: string[]
    timeout_ms: number
    max_output_bytes: number
  }
}

function loadConfig(): ToolConfig {
  if (existsSync(CONFIG_PATH)) {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
  }
  return {
    shell: {
      allowlist: ['ls', 'cat', 'echo', 'date', 'pwd', 'whoami', 'uname', 'df', 'du', 'wc', 'grep', 'find', 'head', 'tail', 'curl', 'git'],
      timeout_ms: 30_000,
      max_output_bytes: 100_000,
    },
  }
}

function resolveCommand(cmd: string): string {
  const knownPaths: Record<string, string> = {
    ls: '/bin/ls', cat: '/bin/cat', echo: '/bin/echo', date: '/bin/date',
    pwd: '/bin/pwd', whoami: '/usr/bin/whoami', uname: '/usr/bin/uname',
    df: '/bin/df', du: '/usr/bin/du', wc: '/usr/bin/wc', grep: '/usr/bin/grep',
    find: '/usr/bin/find', head: '/usr/bin/head', tail: '/usr/bin/tail',
    curl: '/usr/bin/curl', git: '/usr/bin/git',
  }
  return knownPaths[cmd] || cmd
}

export async function executeShellCommand(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const config = loadConfig()
  const parts = command.trim().split(/\s+/)
  const cmd = parts[0]
  const args = parts.slice(1)

  if (!config.shell.allowlist.includes(cmd)) {
    throw new Error(`Command "${cmd}" is not in the allowlist. Allowed: ${config.shell.allowlist.join(', ')}`)
  }

  try {
    const { stdout, stderr } = await execFileAsync(resolveCommand(cmd), args, {
      timeout: config.shell.timeout_ms,
      maxBuffer: config.shell.max_output_bytes,
    })
    return { stdout, stderr, exitCode: 0 }
  } catch (err: any) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || err.message,
      exitCode: err.code ?? 1,
    }
  }
}
