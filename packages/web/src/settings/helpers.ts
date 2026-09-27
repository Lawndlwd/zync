import { errorMessage } from '../helpers/format'

/** Why `text` is not valid JSON, or null when it is. */
export function jsonError(text: string): string | null {
  try {
    JSON.parse(text)
    return null
  } catch (err) {
    return errorMessage(err)
  }
}
