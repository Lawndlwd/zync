import { Router } from 'express'

export const messagesRouter = Router()

// In-memory message store for demo. Replace with real integration.
const demoMessages = [
  {
    id: '1',
    sender: 'Alice Martin',
    channel: 'engineering',
    content: 'Hey, the deploy pipeline is failing on staging. Can you take a look at the CI config?',
    timestamp: new Date(Date.now() - 3600_000).toISOString(),
    isRead: false,
    isArchived: false,
    priority: 'high' as const,
  },
  {
    id: '2',
    sender: 'Bob Chen',
    channel: 'frontend',
    content: 'PR #342 is ready for review. It refactors the auth module to use the new token provider.',
    timestamp: new Date(Date.now() - 7200_000).toISOString(),
    isRead: false,
    isArchived: false,
    priority: 'normal' as const,
  },
  {
    id: '3',
    sender: 'Carol Dupont',
    channel: 'general',
    content: 'Team lunch tomorrow at 12:30, the Ninkasi place near Chatelet.',
    timestamp: new Date(Date.now() - 14400_000).toISOString(),
    isRead: true,
    isArchived: false,
    priority: 'low' as const,
  },
  {
    id: '4',
    sender: 'DevOps Bot',
    channel: 'alerts',
    content: 'WARNING: Memory usage on prod-api-3 exceeded 85% threshold.',
    timestamp: new Date(Date.now() - 1800_000).toISOString(),
    isRead: false,
    isArchived: false,
    priority: 'high' as const,
  },
]

let messages = [...demoMessages]

messagesRouter.get('/', (_req, res) => {
  const customEndpoint = process.env.MESSAGES_ENDPOINT
  if (customEndpoint) {
    // Proxy to custom endpoint
    fetch(customEndpoint)
      .then((r) => r.json())
      .then((data) => res.json(data))
      .catch(() => res.json(messages))
  } else {
    res.json(messages)
  }
})

messagesRouter.patch('/:id/read', (req, res) => {
  messages = messages.map((m) => (m.id === req.params.id ? { ...m, isRead: true } : m))
  res.json({ success: true })
})

messagesRouter.patch('/:id/archive', (req, res) => {
  messages = messages.map((m) => (m.id === req.params.id ? { ...m, isArchived: true } : m))
  res.json({ success: true })
})
