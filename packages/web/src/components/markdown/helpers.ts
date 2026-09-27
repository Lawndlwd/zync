import type { Node as PMNode } from '@milkdown/kit/prose/model'
import { type EditorState, Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'

import { resolveLink } from '../../helpers/docLinks'
import type { Person } from '../../types/people'
import type { Live, Trigger } from './types'

/** `@query` (after a space or at line start) or `[[query` right before the caret, outside code. */
export function findTrigger(state: EditorState): Trigger | null {
  const { selection } = state
  if (!selection.empty) return null
  const $from = selection.$from
  if ($from.parent.type.spec.code || $from.marks().some((m) => m.type.spec.code)) return null
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 60), $from.parentOffset, undefined, '￼')
  const link = before.match(/\[\[([^\]\n￼]{0,50})$/)
  if (link) return { kind: '[[', query: link[1] ?? '', from: $from.pos - link[0].length, to: $from.pos }
  const at = before.match(/(?:^|[\s(])@([\p{L}\p{N}._-]{0,30})$/u)
  const query = at?.[1]
  if (query !== undefined) return { kind: '@', query, from: $from.pos - query.length - 1, to: $from.pos }
  return null
}

export const linksKey = new PluginKey<DecorationSet>('zync-links')

const MENTION = /(^|[^\p{L}\p{N}_@/.])@([a-z0-9][a-z0-9-]{0,31})(?![\p{L}\p{N}_-])/gu

/** Highlights `@id` of known people as chips. */
function mentionDecorations(doc: PMNode, people: Person[]): DecorationSet {
  const byId = new Map(people.map((p) => [p.id, p]))
  const decos: Decoration[] = []
  doc.descendants((node, pos, parent) => {
    if (parent?.type.spec.code) return false
    if (node.isText && node.text && !node.marks.some((m) => m.type.spec.code)) {
      for (const m of node.text.matchAll(MENTION)) {
        const [, lead = '', id = ''] = m
        const p = byId.get(id)
        if (!p) continue
        const start = pos + m.index + lead.length
        decos.push(
          Decoration.inline(start, start + id.length + 1, {
            class: 'mention',
            title: p.name,
            style: p.color ? `--mention:${p.color}` : '',
          }),
        )
      }
    }
    return true
  })
  return DecorationSet.create(doc, decos)
}

export function linksPlugin(live: () => Live, onViewUpdate: (view: EditorView) => void) {
  return $prose(
    () =>
      new Plugin({
        key: linksKey,
        state: {
          init: (_, state) => mentionDecorations(state.doc, live().people),
          apply: (tr, set) => (tr.docChanged || tr.getMeta(linksKey) ? mentionDecorations(tr.doc, live().people) : set),
        },
        props: {
          decorations: (state) => linksKey.getState(state),
          handleClick: (_view, _pos, event) => {
            const a = event.target instanceof HTMLElement ? event.target.closest('a[href]') : null
            const path = a && live().ws ? resolveLink(live().dir, a.getAttribute('href') ?? '') : null
            if (!path) return false
            event.preventDefault()
            live().openLink(path, event.metaKey || event.ctrlKey)
            return true
          },
        },
        view: () => ({ update: (view) => onViewUpdate(view) }),
      }),
  )
}
