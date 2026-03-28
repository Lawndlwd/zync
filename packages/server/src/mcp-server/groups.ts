import type { ZodRawShape } from 'zod'
import { browseSchema, browseTool, screenshotSchema, screenshotTool } from './tools/browser.js'
import { clearCanvasSchema, clearCanvasTool, renderCanvasSchema, renderCanvasTool } from './tools/canvas.js'
import {
  createDocument,
  createDocumentSchema,
  getDocument,
  getDocumentSchema,
  listDocuments,
  listDocumentsSchema,
  updateDocument,
  updateDocumentSchema,
} from './tools/documents.js'
import {
  deleteFileMcp,
  deleteFileSchema,
  listFilesMcp,
  listFilesSchema,
  readFileMcp,
  readFileSchema,
  searchFilesMcp,
  searchFilesSchema,
  writeFileMcp,
  writeFileSchema,
} from './tools/files.js'
import {
  gmailCompose,
  gmailComposeSchema,
  gmailGetThread,
  gmailGetThreadSchema,
  gmailGetUnread,
  gmailGetUnreadSchema,
  gmailSearch,
  gmailSearchSchema,
  gmailSendReply,
  gmailSendReplySchema,
} from './tools/gmail.js'
import {
  calendarCreateEvent,
  calendarCreateEventSchema,
  calendarDeleteEvent,
  calendarDeleteEventSchema,
  calendarListEvents,
  calendarListEventsSchema,
  calendarSearchEvents,
  calendarSearchEventsSchema,
  calendarUpdateEvent,
  calendarUpdateEventSchema,
} from './tools/google-calendar.js'
import { contactsGet, contactsGetSchema, contactsSearch, contactsSearchSchema } from './tools/google-contacts.js'
import {
  driveGetFileContent,
  driveGetFileContentSchema,
  driveListFiles,
  driveListFilesSchema,
  driveSearchFiles,
  driveSearchFilesSchema,
  driveUploadFile,
  driveUploadFileSchema,
} from './tools/google-drive.js'
import {
  gtasksCompleteTask,
  gtasksCompleteTaskSchema,
  gtasksCreateTask,
  gtasksCreateTaskSchema,
  gtasksListTasklists,
  gtasksListTasklistsSchema,
  gtasksListTasks,
  gtasksListTasksSchema,
} from './tools/google-tasks.js'
import {
  createGoalHandler,
  createGoalSchema,
  createLeverHandler,
  createLeverSchema,
  getGoalHandler,
  getGoalSchema,
  getIdentityHandler,
  getIdentitySchema,
  getJournalHandler,
  getJournalSchema,
  getStatsHandler,
  getStatsSchema,
  listComponentsHandler,
  listComponentsSchema,
  listGoalsHandler,
  listGoalsSchema,
  listLeversHandler,
  listLeversSchema,
  scaffoldGoalHandler,
  scaffoldGoalSchema,
  setComponentHandler,
  setComponentSchema,
  setIdentityHandler,
  setIdentitySchema,
  toggleLeverHandler,
  toggleLeverSchema,
  updateGoalHandler,
  updateGoalSchema,
} from './tools/life-os.js'
import {
  deleteMemoryHandler,
  deleteMemorySchema,
  saveInstructionHandler,
  saveInstructionSchema,
  saveMemoryHandler,
  saveMemorySchema,
  searchMemoryHandler,
  searchMemorySchema,
  updateProfileHandler,
  updateProfileSchema,
} from './tools/memory.js'
import {
  addDatabaseItemHandler,
  addDatabaseItemSchema,
  createPlannerCategoryHandler,
  createPlannerCategorySchema,
  createPlannerGoalHandler,
  createPlannerGoalSchema,
  createPlannerPageHandler,
  createPlannerPageSchema,
  createPlannerReminderHandler,
  createPlannerReminderSchema,
  deletePlannerPageHandler,
  deletePlannerPageSchema,
  listPlannerGoalsHandler,
  listPlannerGoalsSchema,
  listPlannerPagesHandler,
  listPlannerPagesSchema,
  queryDatabaseHandler,
  queryDatabaseSchema,
  updateDatabaseItemHandler,
  updateDatabaseItemSchema,
  updatePlannerGoalHandler,
  updatePlannerGoalSchema,
  updatePlannerPageHandler,
  updatePlannerPageSchema,
} from './tools/planner.js'
import {
  createScheduleHandler,
  createScheduleSchema,
  deleteScheduleHandler,
  deleteScheduleSchema,
  listSchedulesHandler,
  listSchedulesSchema,
  toggleScheduleHandler,
  toggleScheduleSchema,
} from './tools/schedules.js'
import { runShell, runShellSchema } from './tools/shell.js'
import {
  createTodo,
  createTodoSchema,
  deleteTodo,
  deleteTodoSchema,
  listTodos,
  listTodosSchema,
  markTodoDone,
  markTodoDoneSchema,
  updateTodo,
  updateTodoSchema,
} from './tools/todos.js'
import { webSearchSchema, webSearchTool } from './tools/web-search.js'

export interface ToolDef {
  name: string
  description: string
  schema: ZodRawShape
  handler: (args: any) => Promise<string>
}

export interface ToolGroup {
  id: string
  label: string
  alwaysOn?: boolean
  tools: ToolDef[]
}

export const DEFAULT_ENABLED_GROUPS = ['web', 'canvas']

export function getToolGroups(): ToolGroup[] {
  return [
    // 1. core (alwaysOn)
    {
      id: 'core',
      label: 'Core',
      alwaysOn: true,
      tools: [
        // Todos (5)
        {
          name: 'create_todo',
          description: 'Create a personal to-do item',
          schema: createTodoSchema.shape,
          handler: (args) => createTodo(args),
        },
        {
          name: 'complete_todo',
          description: 'Mark a personal to-do as done',
          schema: markTodoDoneSchema.shape,
          handler: (args) => markTodoDone(args),
        },
        {
          name: 'list_todos',
          description: 'List all personal to-do items, optionally filtered by status',
          schema: listTodosSchema.shape,
          handler: (args) => listTodos(args),
        },
        {
          name: 'update_todo',
          description: 'Update a personal to-do item (title, description, priority, due_date, status)',
          schema: updateTodoSchema.shape,
          handler: (args) => updateTodo(args),
        },
        {
          name: 'delete_todo',
          description: 'Delete a personal to-do item by ID',
          schema: deleteTodoSchema.shape,
          handler: (args) => deleteTodo(args),
        },
        // Memory & Learning (5)
        {
          name: 'update_profile',
          description:
            'PREFERRED tool for personal info. Update user profile section: identity (name, job, company), technical (skills, languages), interests (hobbies), communication (tone prefs), work_patterns (schedule). Use this instead of save_memory for anything about the user.',
          schema: updateProfileSchema.shape,
          handler: (args) => updateProfileHandler(args),
        },
        {
          name: 'save_instruction',
          description:
            'Save a rule the user wants you to follow. Use when user says "remember to always X" or "never do Y".',
          schema: saveInstructionSchema.shape,
          handler: (args) => saveInstructionHandler(args),
        },
        {
          name: 'save_memory',
          description:
            'Save a fact or context that does NOT fit in profile sections. Use for project details, one-off facts, external context. Do NOT use for personal info like name/job/skills — use update_profile instead.',
          schema: saveMemorySchema.shape,
          handler: (args) => saveMemoryHandler(args),
        },
        {
          name: 'recall',
          description: 'Search memories for relevant information. Uses hybrid keyword + semantic search.',
          schema: searchMemorySchema.shape,
          handler: (args) => searchMemoryHandler(args),
        },
        {
          name: 'forget',
          description: 'Delete a memory or instruction by ID.',
          schema: deleteMemorySchema.shape,
          handler: (args) => deleteMemoryHandler(args),
        },
        // Schedules (4)
        {
          name: 'create_schedule',
          description:
            'Create a recurring scheduled task (cron job). The bot will run the prompt at the specified schedule and send you the result.',
          schema: createScheduleSchema.shape,
          handler: (args) => createScheduleHandler(args),
        },
        {
          name: 'list_schedules',
          description: 'List all scheduled tasks for the current chat.',
          schema: listSchedulesSchema.shape,
          handler: (args) => listSchedulesHandler(args),
        },
        {
          name: 'delete_schedule',
          description: 'Delete a scheduled task by ID.',
          schema: deleteScheduleSchema.shape,
          handler: (args) => deleteScheduleHandler(args),
        },
        {
          name: 'toggle_schedule',
          description: 'Enable or disable a scheduled task.',
          schema: toggleScheduleSchema.shape,
          handler: (args) => toggleScheduleHandler(args),
        },
        // Documents (4)
        {
          name: 'list_docs',
          description: 'List documents from the knowledge base, optionally filtered by folder',
          schema: listDocumentsSchema.shape,
          handler: (args) => listDocuments(args),
        },
        {
          name: 'read_doc',
          description: 'Read a document from the knowledge base',
          schema: getDocumentSchema.shape,
          handler: (args) => getDocument(args),
        },
        {
          name: 'create_doc',
          description: 'Create a new document in the knowledge base',
          schema: createDocumentSchema.shape,
          handler: (args) => createDocument(args),
        },
        {
          name: 'update_doc',
          description: 'Update a document in the knowledge base (content or title)',
          schema: updateDocumentSchema.shape,
          handler: (args) => updateDocument(args),
        },
      ],
    },

    // 2. files
    {
      id: 'files',
      label: 'Files',
      tools: [
        {
          name: 'read_file',
          description: 'Read a file from allowed paths',
          schema: readFileSchema.shape,
          handler: (args) => readFileMcp(args),
        },
        {
          name: 'write_file',
          description: 'Write content to a file in allowed paths',
          schema: writeFileSchema.shape,
          handler: (args) => writeFileMcp(args),
        },
        {
          name: 'delete_file',
          description: 'Delete a file from allowed paths',
          schema: deleteFileSchema.shape,
          handler: (args) => deleteFileMcp(args),
        },
        {
          name: 'list_files',
          description: 'List files in a directory',
          schema: listFilesSchema.shape,
          handler: (args) => listFilesMcp(args),
        },
        {
          name: 'search_files',
          description: 'Search for files matching a regex pattern',
          schema: searchFilesSchema.shape,
          handler: (args) => searchFilesMcp(args),
        },
      ],
    },

    // 3. shell
    {
      id: 'shell',
      label: 'Shell',
      tools: [
        {
          name: 'shell',
          description: 'Execute a shell command (restricted to allowlist)',
          schema: runShellSchema.shape,
          handler: (args) => runShell(args),
        },
      ],
    },

    // 4. web
    {
      id: 'web',
      label: 'Web',
      tools: [
        {
          name: 'search_web',
          description: 'Search the web using DuckDuckGo',
          schema: webSearchSchema.shape,
          handler: (args) => webSearchTool(args),
        },
        {
          name: 'browse',
          description: 'Navigate to a URL and extract page content',
          schema: browseSchema.shape,
          handler: (args) => browseTool(args),
        },
        {
          name: 'screenshot',
          description: 'Take a screenshot of a URL',
          schema: screenshotSchema.shape,
          handler: (args) => screenshotTool(args),
        },
      ],
    },

    // 5. canvas
    {
      id: 'canvas',
      label: 'Canvas',
      tools: [
        {
          name: 'render_canvas',
          description:
            'Render COMPLETE HTML/CSS/JS to the live canvas. Call ONCE with all content — never call multiple times.',
          schema: renderCanvasSchema.shape,
          handler: (args) => renderCanvasTool(args),
        },
        {
          name: 'clear_canvas',
          description: 'Clear the live canvas',
          schema: clearCanvasSchema.shape,
          handler: () => clearCanvasTool(),
        },
      ],
    },

    // 6. gmail
    {
      id: 'gmail',
      label: 'Gmail',
      tools: [
        {
          name: 'check_emails',
          description:
            'Fetch unread emails from the last N days. Returns sender, subject, snippet, date for each email.',
          schema: gmailGetUnreadSchema.shape,
          handler: (args) => gmailGetUnread(args),
        },
        {
          name: 'read_email_thread',
          description: 'Fetch a full email thread by thread ID. Returns all messages with decoded bodies.',
          schema: gmailGetThreadSchema.shape,
          handler: (args) => gmailGetThread(args),
        },
        {
          name: 'reply_email',
          description: 'Send a reply to an email thread. NEVER send without user confirmation.',
          schema: gmailSendReplySchema.shape,
          handler: (args) => gmailSendReply(args),
        },
        {
          name: 'send_email',
          description: 'Compose and send a new email. NEVER send without user confirmation.',
          schema: gmailComposeSchema.shape,
          handler: (args) => gmailCompose(args),
        },
        {
          name: 'search_emails',
          description:
            'Search emails using Gmail search syntax (e.g. "from:john subject:meeting", "is:unread", "newer_than:2d").',
          schema: gmailSearchSchema.shape,
          handler: (args) => gmailSearch(args),
        },
      ],
    },

    // 7. calendar
    {
      id: 'calendar',
      label: 'Calendar',
      tools: [
        {
          name: 'check_calendar',
          description: 'List upcoming calendar events for the next N days. Returns title, time, location, attendees.',
          schema: calendarListEventsSchema.shape,
          handler: (args) => calendarListEvents(args),
        },
        {
          name: 'create_event',
          description:
            'Create a new calendar event with summary, time, attendees, and location. NEVER create without user confirmation.',
          schema: calendarCreateEventSchema.shape,
          handler: (args) => calendarCreateEvent(args),
        },
        {
          name: 'update_event',
          description: 'Update an existing calendar event (title, time, location, attendees).',
          schema: calendarUpdateEventSchema.shape,
          handler: (args) => calendarUpdateEvent(args),
        },
        {
          name: 'delete_event',
          description: 'Delete a calendar event by ID. NEVER delete without user confirmation.',
          schema: calendarDeleteEventSchema.shape,
          handler: (args) => calendarDeleteEvent(args),
        },
        {
          name: 'search_events',
          description: 'Search calendar events by query across past and future dates.',
          schema: calendarSearchEventsSchema.shape,
          handler: (args) => calendarSearchEvents(args),
        },
      ],
    },

    // 8. drive
    {
      id: 'drive',
      label: 'Drive',
      tools: [
        {
          name: 'list_drive',
          description: 'List files in Google Drive, optionally within a specific folder.',
          schema: driveListFilesSchema.shape,
          handler: (args) => driveListFiles(args),
        },
        {
          name: 'search_drive',
          description: 'Search Google Drive files by name or content.',
          schema: driveSearchFilesSchema.shape,
          handler: (args) => driveSearchFiles(args),
        },
        {
          name: 'read_drive_file',
          description:
            'Read the text content of a Google Drive file. Google Docs are exported as plain text, Sheets as CSV.',
          schema: driveGetFileContentSchema.shape,
          handler: (args) => driveGetFileContent(args),
        },
        {
          name: 'upload_to_drive',
          description: 'Upload/create a text file to Google Drive. NEVER upload without user confirmation.',
          schema: driveUploadFileSchema.shape,
          handler: (args) => driveUploadFile(args),
        },
      ],
    },

    // 9. contacts
    {
      id: 'contacts',
      label: 'Contacts',
      tools: [
        {
          name: 'search_contacts',
          description: 'Search contacts by name, email, or phone number.',
          schema: contactsSearchSchema.shape,
          handler: (args) => contactsSearch(args),
        },
        {
          name: 'get_contact',
          description: 'Get detailed information about a specific contact by resource name.',
          schema: contactsGetSchema.shape,
          handler: (args) => contactsGet(args),
        },
      ],
    },

    // 10. tasks
    {
      id: 'tasks',
      label: 'Tasks',
      tools: [
        {
          name: 'list_task_lists',
          description: 'List all task lists.',
          schema: gtasksListTasklistsSchema.shape,
          handler: (args) => gtasksListTasklists(args),
        },
        {
          name: 'list_tasks',
          description: 'List tasks in a task list.',
          schema: gtasksListTasksSchema.shape,
          handler: (args) => gtasksListTasks(args),
        },
        {
          name: 'create_task',
          description: 'Create a new task with title, notes, and due date.',
          schema: gtasksCreateTaskSchema.shape,
          handler: (args) => gtasksCreateTask(args),
        },
        {
          name: 'complete_task',
          description: 'Mark a task as completed.',
          schema: gtasksCompleteTaskSchema.shape,
          handler: (args) => gtasksCompleteTask(args),
        },
      ],
    },

    // 11. planner (alwaysOn)
    {
      id: 'planner',
      label: 'Planner',
      alwaysOn: true,
      tools: [
        {
          name: 'create_planner_page',
          description: 'Create a new page in the planner under a category',
          schema: createPlannerPageSchema.shape,
          handler: (args) => createPlannerPageHandler(args),
        },
        {
          name: 'update_planner_page',
          description: 'Update a planner page title or content',
          schema: updatePlannerPageSchema.shape,
          handler: (args) => updatePlannerPageHandler(args),
        },
        {
          name: 'delete_planner_page',
          description: 'Delete a planner page by ID (cannot delete system pages)',
          schema: deletePlannerPageSchema.shape,
          handler: (args) => deletePlannerPageHandler(args),
        },
        {
          name: 'list_planner_pages',
          description: 'List planner pages, optionally filtered by category slug',
          schema: listPlannerPagesSchema.shape,
          handler: (args) => listPlannerPagesHandler(args),
        },
        {
          name: 'create_planner_category',
          description: 'Create a new planner category',
          schema: createPlannerCategorySchema.shape,
          handler: (args) => createPlannerCategoryHandler(args),
        },
        {
          name: 'create_planner_goal',
          description: 'Create a goal in the planner under a category',
          schema: createPlannerGoalSchema.shape,
          handler: (args) => createPlannerGoalHandler(args),
        },
        {
          name: 'update_planner_goal',
          description: 'Update a planner goal status, progress, or title',
          schema: updatePlannerGoalSchema.shape,
          handler: (args) => updatePlannerGoalHandler(args),
        },
        {
          name: 'list_planner_goals',
          description: 'List planner goals, optionally filtered by category or status',
          schema: listPlannerGoalsSchema.shape,
          handler: (args) => listPlannerGoalsHandler(args),
        },
        {
          name: 'create_planner_reminder',
          description: 'Create a reminder with a due date/time',
          schema: createPlannerReminderSchema.shape,
          handler: (args) => createPlannerReminderHandler(args),
        },
        {
          name: 'add_database_item',
          description: 'Add a new item to a planner database',
          schema: addDatabaseItemSchema.shape,
          handler: (args) => addDatabaseItemHandler(args),
        },
        {
          name: 'update_database_item',
          description: 'Update an item in a planner database',
          schema: updateDatabaseItemSchema.shape,
          handler: (args) => updateDatabaseItemHandler(args),
        },
        {
          name: 'query_database',
          description: 'Query all items from a planner database',
          schema: queryDatabaseSchema.shape,
          handler: (args) => queryDatabaseHandler(args),
        },
      ],
    },

    // 12. life-os (alwaysOn) — Dan Koe framework: vision, goals, levers, journal
    {
      id: 'life-os',
      label: 'Life OS',
      alwaysOn: true,
      tools: [
        {
          name: 'get_identity',
          description: 'Get the current identity statement ("I am the type of person who...")',
          schema: getIdentitySchema.shape,
          handler: () => getIdentityHandler(),
        },
        {
          name: 'set_identity',
          description: 'Set or update the identity statement',
          schema: setIdentitySchema.shape,
          handler: (args) => setIdentityHandler(args),
        },
        {
          name: 'list_game_board',
          description:
            'List all Life OS Game Board components (vision, anti-vision, 1-year goal, 1-month project, constraints)',
          schema: listComponentsSchema.shape,
          handler: () => listComponentsHandler(),
        },
        {
          name: 'set_game_board_component',
          description:
            'Create or update a Game Board component. Types: anti-vision, vision, one-year-goal, one-month-project, constraints. Updates the existing active component of that type if one exists.',
          schema: setComponentSchema.shape,
          handler: (args) => setComponentHandler(args),
        },
        {
          name: 'list_life_goals',
          description:
            'List top-level Life OS goals (fractal: year→month→week→day). These appear in the Projects view.',
          schema: listGoalsSchema.shape,
          handler: (args) => listGoalsHandler(args),
        },
        {
          name: 'get_life_goal',
          description: 'Get a Life OS goal with its children',
          schema: getGoalSchema.shape,
          handler: (args) => getGoalHandler(args),
        },
        {
          name: 'create_life_goal',
          description:
            'Create a Life OS goal. Year goals auto-sync to Game Board. Use scaffold_goal to auto-generate children (year→12 months, month→weeks, week→days).',
          schema: createGoalSchema.shape,
          handler: (args) => createGoalHandler(args),
        },
        {
          name: 'update_life_goal',
          description: 'Update a Life OS goal (title, status, progress)',
          schema: updateGoalSchema.shape,
          handler: (args) => updateGoalHandler(args),
        },
        {
          name: 'scaffold_goal',
          description:
            'Auto-generate children for a goal: year→12 months, month→weeks, week→days. Only works if no children exist yet.',
          schema: scaffoldGoalSchema.shape,
          handler: (args) => scaffoldGoalHandler(args),
        },
        {
          name: 'list_daily_levers',
          description: 'List daily levers (priority actions) for a date. Defaults to today.',
          schema: listLeversSchema.shape,
          handler: (args) => listLeversHandler(args),
        },
        {
          name: 'create_daily_lever',
          description: 'Create a daily lever (priority action for the day). Max 2-3 per day recommended.',
          schema: createLeverSchema.shape,
          handler: (args) => createLeverHandler(args),
        },
        {
          name: 'toggle_daily_lever',
          description: 'Toggle a daily lever as complete/incomplete',
          schema: toggleLeverSchema.shape,
          handler: (args) => toggleLeverHandler(args),
        },
        {
          name: 'get_journal',
          description: 'Get journal entries for a date. Types: morning, evening, breaker, walking, freeform.',
          schema: getJournalSchema.shape,
          handler: (args) => getJournalHandler(args),
        },
        {
          name: 'get_life_stats',
          description: 'Get Life OS stats: XP, level, streak, lever completion, journal status',
          schema: getStatsSchema.shape,
          handler: () => getStatsHandler(),
        },
      ],
    },
  ]
}
