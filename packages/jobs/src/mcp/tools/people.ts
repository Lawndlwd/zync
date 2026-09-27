import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { createPerson, listPeople } from '../../people/index.js'
import { safe } from '../format.js'

export function registerPeopleTools(server: McpServer): void {
  server.registerTool(
    'list_people',
    { description: 'List people cards can be assigned to. "me" is the user, "ai" makes the AI run the card.' },
    safe(async () => {
      return listPeople()
    }),
  )

  server.registerTool(
    'add_person',
    {
      description: 'Create a person to assign cards to. Returns their id.',
      inputSchema: { name: z.string(), color: z.string().optional().describe('Hex color like #22c55e') },
    },
    safe(async (input) => {
      return createPerson(input)
    }),
  )
}
