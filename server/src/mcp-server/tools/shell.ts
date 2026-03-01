import { z } from 'zod'
import { executeShellCommand } from '../../agent/tools/shell.js'

export const runShellSchema = z.object({
  command: z.string().describe('The shell command to execute'),
})

export async function runShell(args: z.infer<typeof runShellSchema>): Promise<string> {
  const result = await executeShellCommand(args.command)
  const parts: string[] = []
  if (result.stdout) parts.push(`stdout:\n${result.stdout}`)
  if (result.stderr) parts.push(`stderr:\n${result.stderr}`)
  parts.push(`exit code: ${result.exitCode}`)
  return parts.join('\n')
}
