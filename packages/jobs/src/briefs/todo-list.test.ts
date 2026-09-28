import { describe, expect, it } from 'vitest'

import { formatTodo, joinTodos, parseTodoLine, splitTodos } from './todo-list.js'

describe('brief checklist', () => {
  it('writes a to-do as one checklist line and reads it back', () => {
    const todo = {
      title: 'Reply to Sara about the offer',
      source: 'Gmail · work',
      link: 'https://mail.google.com/x#all/1',
      card: 'Launch/Reply to Sara.md',
      done: true,
    }
    const line = formatTodo(todo)
    expect(line).toBe(
      '- [x] Reply to Sara about the offer — Gmail · work · [open](https://mail.google.com/x#all/1) · [card](<Launch/Reply to Sara.md>)',
    )
    expect(parseTodoLine(line)).toEqual(todo)
  })

  it('reads lines written by hand or by the editor', () => {
    expect(parseTodoLine('* [ ] Call the bank')).toEqual({ title: 'Call the bank', done: false })
    expect(parseTodoLine('- [X] Pay — Revolut · [card](Work/Pay%20it.md)')).toEqual({
      title: 'Pay',
      source: 'Revolut',
      card: 'Work/Pay it.md',
      done: true,
    })
    expect(parseTodoLine('- plain bullet')).toBeNull()
  })

  it('splits the page into its checklist and the rest, and joins them back', () => {
    const page = '## Meetings\n- 09:30 Standup\n\n## To-do\n- [ ] A\n- [x] B — Calendar\n\n## FYI\n- news'
    const { todos, rest } = splitTodos(page)
    expect(todos.map((t) => [t.title, t.done])).toEqual([
      ['A', false],
      ['B', true],
    ])
    expect(rest).toBe('## Meetings\n- 09:30 Standup\n\n## FYI\n- news')
    expect(joinTodos(todos, rest)).toBe(
      '## To-do\n- [ ] A\n- [x] B — Calendar\n\n## Meetings\n- 09:30 Standup\n\n## FYI\n- news',
    )
    expect(splitTodos('## Meetings\nnone')).toEqual({ todos: [], rest: '## Meetings\nnone' })
  })
})
