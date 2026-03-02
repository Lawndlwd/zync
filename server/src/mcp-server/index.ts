#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env from project root (server/.env)
config({ path: resolve(import.meta.dirname, '../../.env') })

// Initialize database before tools that use it
import { initDb } from '../bot/memory/db.js'
import { initTodosTable } from './tools/todos.js'
initDb()
initTodosTable()

import {
  createTodo, createTodoSchema,
  markTodoDone, markTodoDoneSchema,
  listTodos, listTodosSchema,
  updateTodo, updateTodoSchema,
  deleteTodo, deleteTodoSchema,
} from './tools/todos.js'
import {
  listDocuments, listDocumentsSchema,
  getDocument, getDocumentSchema,
  createDocument, createDocumentSchema,
  updateDocument, updateDocumentSchema,
} from './tools/documents.js'
import {
  saveMemoryHandler, saveMemorySchema,
  searchMemoryHandler, searchMemorySchema,
  deleteMemoryHandler, deleteMemorySchema,
} from './tools/memory.js'
import {
  createScheduleHandler, createScheduleSchema,
  listSchedulesHandler, listSchedulesSchema,
  deleteScheduleHandler, deleteScheduleSchema,
  toggleScheduleHandler, toggleScheduleSchema,
} from './tools/schedules.js'
import { runShell, runShellSchema } from './tools/shell.js'
import {
  readFileMcp, readFileSchema,
  writeFileMcp, writeFileSchema,
  deleteFileMcp, deleteFileSchema,
  listFilesMcp, listFilesSchema,
  searchFilesMcp, searchFilesSchema,
} from './tools/files.js'
import { webSearchTool, webSearchSchema } from './tools/web-search.js'
import { browseTool, browseSchema, screenshotTool, screenshotSchema } from './tools/browser.js'
import { renderCanvasTool, renderCanvasSchema, clearCanvasTool, clearCanvasSchema } from './tools/canvas.js'
import {
  gmailGetUnread, gmailGetUnreadSchema,
  gmailGetThread, gmailGetThreadSchema,
  gmailSendReply, gmailSendReplySchema,
  gmailCompose, gmailComposeSchema,
  gmailSearch, gmailSearchSchema,
} from './tools/gmail.js'

const server = new McpServer({
  name: 'zync',
  version: '1.0.0',
})


// --- Todo tools (5) ---

server.tool(
  'create_todo',
  'Create a personal to-do item',
  createTodoSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await createTodo(args) }],
  })
)

server.tool(
  'mark_todo_done',
  'Mark a personal to-do as done',
  markTodoDoneSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await markTodoDone(args) }],
  })
)

server.tool(
  'list_todos',
  'List all personal to-do items, optionally filtered by status',
  listTodosSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await listTodos(args) }],
  })
)

server.tool(
  'update_todo',
  'Update a personal to-do item (title, description, priority, due_date, status)',
  updateTodoSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await updateTodo(args) }],
  })
)

server.tool(
  'delete_todo',
  'Delete a personal to-do item by ID',
  deleteTodoSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await deleteTodo(args) }],
  })
)

// --- Memory tools (3) ---

server.tool(
  'save_memory',
  'Save a piece of information to long-term memory. Use categories like: preference, fact, project, person, decision.',
  saveMemorySchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await saveMemoryHandler(args) }],
  })
)

server.tool(
  'search_memory',
  'Search your long-term memory for relevant information. Uses full-text search.',
  searchMemorySchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await searchMemoryHandler(args) }],
  })
)

server.tool(
  'delete_memory',
  'Delete a specific memory by its ID.',
  deleteMemorySchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await deleteMemoryHandler(args) }],
  })
)

// --- Schedule tools (4) ---

server.tool(
  'create_schedule',
  'Create a recurring scheduled task (cron job). The bot will run the prompt at the specified schedule and send you the result.',
  createScheduleSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await createScheduleHandler(args) }],
  })
)

server.tool(
  'list_schedules',
  'List all scheduled tasks for the current chat.',
  listSchedulesSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await listSchedulesHandler(args) }],
  })
)

server.tool(
  'delete_schedule',
  'Delete a scheduled task by ID.',
  deleteScheduleSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await deleteScheduleHandler(args) }],
  })
)

server.tool(
  'toggle_schedule',
  'Enable or disable a scheduled task.',
  toggleScheduleSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await toggleScheduleHandler(args) }],
  })
)

// --- Document tools (4) ---

server.tool(
  'list_documents',
  'List documents from the knowledge base, optionally filtered by folder',
  listDocumentsSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await listDocuments(args) }],
  })
)

server.tool(
  'get_document',
  'Read a document from the knowledge base',
  getDocumentSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await getDocument(args) }],
  })
)

server.tool(
  'create_document',
  'Create a new document in the knowledge base',
  createDocumentSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await createDocument(args) }],
  })
)

server.tool(
  'update_document',
  'Update a document in the knowledge base (content or title)',
  updateDocumentSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await updateDocument(args) }],
  })
)

// --- Shell tool (1) ---

server.tool(
  'run_shell',
  'Execute a shell command (restricted to allowlist)',
  runShellSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await runShell(args) }],
  })
)

// --- File tools (5) ---

server.tool(
  'read_file',
  'Read a file from allowed paths',
  readFileSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await readFileMcp(args) }],
  })
)

server.tool(
  'write_file',
  'Write content to a file in allowed paths',
  writeFileSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await writeFileMcp(args) }],
  })
)

server.tool(
  'delete_file',
  'Delete a file from allowed paths',
  deleteFileSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await deleteFileMcp(args) }],
  })
)

server.tool(
  'list_files',
  'List files in a directory',
  listFilesSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await listFilesMcp(args) }],
  })
)

server.tool(
  'search_files',
  'Search for files matching a regex pattern',
  searchFilesSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await searchFilesMcp(args) }],
  })
)

// --- Web search tool (1) ---

server.tool(
  'web_search',
  'Search the web using DuckDuckGo',
  webSearchSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await webSearchTool(args) }],
  })
)

// --- Browser tools (2) ---

server.tool('browse', 'Navigate to a URL and extract page content', browseSchema.shape,
  async (args) => ({ content: [{ type: 'text' as const, text: await browseTool(args) }] }))

server.tool('screenshot', 'Take a screenshot of a URL', screenshotSchema.shape,
  async (args) => ({ content: [{ type: 'text' as const, text: await screenshotTool(args) }] }))

// --- Canvas tools (2) ---

server.tool('render_canvas', 'Render COMPLETE HTML/CSS/JS to the live canvas. Call ONCE with all content — never call multiple times.', renderCanvasSchema.shape,
  async (args) => ({ content: [{ type: 'text' as const, text: await renderCanvasTool(args) }] }))

server.tool('clear_canvas', 'Clear the live canvas', clearCanvasSchema.shape,
  async () => ({ content: [{ type: 'text' as const, text: await clearCanvasTool() }] }))

// --- Gmail tools (5) ---

server.tool(
  'gmail_get_unread',
  'Fetch unread emails from the last N days. Returns sender, subject, snippet, date for each email.',
  gmailGetUnreadSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await gmailGetUnread(args) }],
  })
)

server.tool(
  'gmail_get_thread',
  'Fetch a full email thread by thread ID. Returns all messages with decoded bodies.',
  gmailGetThreadSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await gmailGetThread(args) }],
  })
)

server.tool(
  'gmail_send_reply',
  'Send a reply to an email thread. NEVER send without user confirmation.',
  gmailSendReplySchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await gmailSendReply(args) }],
  })
)

server.tool(
  'gmail_compose',
  'Compose and send a new email. NEVER send without user confirmation.',
  gmailComposeSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await gmailCompose(args) }],
  })
)

server.tool(
  'gmail_search',
  'Search emails using Gmail search syntax (e.g. "from:john subject:meeting", "is:unread", "newer_than:2d").',
  gmailSearchSchema.shape,
  async (args) => ({
    content: [{ type: 'text' as const, text: await gmailSearch(args) }],
  })
)

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('zync MCP server running on stdio')
}

main().catch((err) => {
  console.error('MCP server error:', err)
  process.exit(1)
})
