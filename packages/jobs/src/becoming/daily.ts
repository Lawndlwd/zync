import { errorMessage } from '../errors.js'
import { addDays } from '../helpers/dates.js'
import { appLink, push } from '../notify.js'
import type { Workspace } from '../workspaces.js'
import { finalizeDays } from './cast.js'
import { externalBusy } from './external.js'
import { becomingToday } from './today.js'

/** When yesterday's evidence becomes votes: late enough that a guard ending at midnight is over. */
export const FINALIZE_AT = '03:00'
/** When manual identities without a vote get a nudge. */
export const NUDGE_AT = process.env.BECOMING_NUDGE_AT || '20:30'

export type Log = (...args: unknown[]) => void

/** Once a day each: finalize yesterday at 03:00, nudge at 20:30. Driven by the scheduler's scan. */
export class BecomingDaily {
  private finalizedOn = ''
  private nudgedOn = ''

  constructor(private log: Log = () => {}) {}

  async tick(workspaces: Workspace[], now: string): Promise<void> {
    const date = now.slice(0, 10)
    const time = now.slice(11, 16)
    if (time >= FINALIZE_AT && this.finalizedOn !== date) {
      this.finalizedOn = date
      const external = await externalBusy(addDays(date, -7), date)
      for (const ws of workspaces) {
        const added = await finalizeDays(ws.path, date, external).catch((err: unknown) => {
          this.log(`becoming: finalize ${ws.name}: ${errorMessage(err)}`)
          return 0
        })
        if (added) this.log(`becoming: ${ws.name}: ${added} vote${added === 1 ? '' : 's'} from what Zync saw`)
      }
    }
    if (time >= NUDGE_AT && this.nudgedOn !== date) {
      this.nudgedOn = date
      for (const ws of workspaces) await this.nudge(ws, date, now)
    }
  }

  private async nudge(ws: Workspace, date: string, now: string): Promise<void> {
    const today = await becomingToday(ws.path, date, [], now).catch(() => null)
    const waiting = today?.rows.filter((r) => r.manual && !r.vote) ?? []
    if (waiting.length === 0) return
    const body = waiting
      .map((r) => {
        const small = r.identity.small ? ` Even "${r.identity.small.toLowerCase()}" counts.` : ''
        return `${r.identity.statement}: did you ${r.identity.action.toLowerCase()} today?${small}`
      })
      .join('\n')
    await push({ title: `Becoming (${ws.name})`, body, tags: 'seedling', link: appLink(ws.name, 'overview') })
  }
}
