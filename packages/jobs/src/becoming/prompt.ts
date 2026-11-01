import { guardApplies } from './evidence.js'
import { listIdentities, today } from './store.js'
import type { Guard, Identity } from './types.js'

const guardLine = (i: Identity, g: Guard) =>
  `- ${g.from}–${g.to}${g.days ? ` (${g.days.join(', ')})` : ''}: ${g.label} (for "${i.statement}")`

/**
 * The Becoming block of the system prompt: who the user is becoming, and the guards every chat and
 * job must respect. Empty when the workspace has no identities.
 */
export async function buildBecomingPrompt(wsPath: string, day = today()): Promise<string> {
  const identities = await listIdentities(wsPath).catch(() => [])
  if (identities.length === 0) return ''
  const guards = identities.flatMap((i) => i.guards.map((g) => ({ i, g })))
  const out = [
    '<becoming>',
    'The user is becoming these people (Becoming/ pages; list_identities, vote, becoming_today). Frame suggestions through them when it helps, never lecture.',
    ...identities.map(
      (i) =>
        `- ${i.statement} (${i.stage}): ${i.action}${i.small ? `; on heavy days just: ${i.small}` : ''}${i.when ? `; ${i.when}` : ''}`,
    ),
  ]
  if (guards.length > 0) {
    out.push(
      '',
      'Guards: standing rules. Never schedule events, cards, reminders or jobs inside them. When a time the user asks for falls inside one, move it just before and say so in one line ("I moved it to 17:30 because of your 19:00 guard"); keep their time only if they insist.',
      ...guards.map(({ i, g }) => `${guardLine(i, g)}${guardApplies(g, day) ? '' : ' (not today)'}`),
    )
  }
  out.push(
    '',
    'When the user says they did one ("I ran this morning"), record it with vote (small for the 2-minute version).',
    '</becoming>',
  )
  return out.join('\n')
}
