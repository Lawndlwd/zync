import { z } from 'zod'

export const workspaceArg = z
  .string()
  .describe(
    'Workspace name, or the absolute path of the current project directory (use your working directory when the user means "this project").',
  )
