// Slows down guessing: after a few failed sign-ins, every further try is refused for a while, and
// the wait doubles each time (up to an hour). One person uses zync, so the limit is global as well
// as per address: a spread-out attack is slowed the same way.

const FREE_TRIES = 5
const FIRST_LOCK_MS = 60_000
const MAX_LOCK_MS = 3_600_000
/** Failures older than this are forgotten. */
const WINDOW_MS = 15 * 60_000

type Entry = { failures: number[]; lockedUntil: number; locks: number }

export class FailureLimiter {
  private entries = new Map<string, Entry>()

  constructor(private readonly now: () => number = Date.now) {}

  private entry(key: string): Entry {
    let e = this.entries.get(key)
    if (!e) {
      e = { failures: [], lockedUntil: 0, locks: 0 }
      this.entries.set(key, e)
    }
    return e
  }

  /** Milliseconds to wait before `keys` may try again (0 = go ahead). */
  retryAfter(keys: string[]): number {
    const now = this.now()
    return Math.max(0, ...keys.map((k) => (this.entries.get(k)?.lockedUntil ?? 0) - now))
  }

  /** A failed try; true when it just triggered a lock (worth an alert). */
  fail(keys: string[]): boolean {
    const now = this.now()
    let locked = false
    for (const k of keys) {
      const e = this.entry(k)
      e.failures = [...e.failures.filter((t) => now - t < WINDOW_MS), now]
      if (e.failures.length >= FREE_TRIES) {
        e.lockedUntil = now + Math.min(FIRST_LOCK_MS * 2 ** e.locks, MAX_LOCK_MS)
        e.locks++
        e.failures = []
        locked = true
      }
    }
    return locked
  }

  /** A successful sign-in clears the record for these keys. */
  succeed(keys: string[]): void {
    for (const k of keys) this.entries.delete(k)
  }
}
