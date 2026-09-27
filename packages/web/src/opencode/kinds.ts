import type { LibraryKind } from '../types/opencode'

export const KINDS: Array<{ kind: LibraryKind; title: string; one: string; help: string; docs: string }> = [
  {
    kind: 'agent',
    title: 'Agents',
    one: 'agent',
    help: 'Specialised assistants. Frontmatter: description, mode (primary · subagent · all), model, tools, permission. The page is the system prompt.',
    docs: 'https://opencode.ai/docs/agents/',
  },
  {
    kind: 'command',
    title: 'Commands',
    one: 'command',
    help: 'Reusable prompts you run as /name in the chat. Frontmatter: description, agent, model. $ARGUMENTS is replaced by what you type after the command.',
    docs: 'https://opencode.ai/docs/commands/',
  },
  {
    kind: 'skill',
    title: 'Skills',
    one: 'skill',
    help: 'Know-how the AI loads when a task matches its description. A skill is a folder: SKILL.md (name, description) plus any files it refers to.',
    docs: 'https://opencode.ai/docs/skills/',
  },
]
