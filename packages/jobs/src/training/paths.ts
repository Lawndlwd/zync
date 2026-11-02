import path from 'node:path'

import { checkMdFile } from '../helpers/files.js'
import { safeResolve } from '../workspaces.js'
import { BODY_FILE, EXERCISES_DIR, LOG_DIR, PROFILE_FILE, ROUTINES_DIR } from './types.js'

export const routinesDir = (wsPath: string) => safeResolve(wsPath, ROUTINES_DIR)
export const logDir = (wsPath: string) => safeResolve(wsPath, LOG_DIR)
export const exercisesDir = (wsPath: string) => safeResolve(wsPath, EXERCISES_DIR)
export const profilePath = (wsPath: string) => safeResolve(wsPath, PROFILE_FILE)
export const bodyPath = (wsPath: string) => safeResolve(wsPath, BODY_FILE)

/** A `.md` file name from a request inside `dir`; anything else is an unknown `what` (404). */
export const pageIn = (dir: string, file: string, what: string) => path.join(dir, checkMdFile(file, what))
