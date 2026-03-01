import { initSchedulesTable } from './db.js'
import { loadSchedules } from './scheduler.js'

export { stopAllSchedules } from './scheduler.js'

export function initHeartbeat(): void {
  initSchedulesTable()
  loadSchedules()
}
