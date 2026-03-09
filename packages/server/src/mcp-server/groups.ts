import type { ZodRawShape } from 'zod'

import {
  createTodo, createTodoSchema,
  markTodoDone, markTodoDoneSchema,
  listTodos, listTodosSchema,
  updateTodo, updateTodoSchema,
  deleteTodo, deleteTodoSchema,
} from './tools/todos.js'
import {
  updateProfileHandler, updateProfileSchema,
  saveInstructionHandler, saveInstructionSchema,
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
import {
  listDocuments, listDocumentsSchema,
  getDocument, getDocumentSchema,
  createDocument, createDocumentSchema,
  updateDocument, updateDocumentSchema,
} from './tools/documents.js'
import {
  readFileMcp, readFileSchema,
  writeFileMcp, writeFileSchema,
  deleteFileMcp, deleteFileSchema,
  listFilesMcp, listFilesSchema,
  searchFilesMcp, searchFilesSchema,
} from './tools/files.js'
import { runShell, runShellSchema } from './tools/shell.js'
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
import {
  calendarListEvents, calendarListEventsSchema,
  calendarCreateEvent, calendarCreateEventSchema,
  calendarUpdateEvent, calendarUpdateEventSchema,
  calendarDeleteEvent, calendarDeleteEventSchema,
  calendarSearchEvents, calendarSearchEventsSchema,
} from './tools/google-calendar.js'
import {
  driveListFiles, driveListFilesSchema,
  driveSearchFiles, driveSearchFilesSchema,
  driveGetFileContent, driveGetFileContentSchema,
  driveUploadFile, driveUploadFileSchema,
} from './tools/google-drive.js'
import {
  contactsSearch, contactsSearchSchema,
  contactsGet, contactsGetSchema,
} from './tools/google-contacts.js'
import {
  gtasksListTasklists, gtasksListTasklistsSchema,
  gtasksListTasks, gtasksListTasksSchema,
  gtasksCreateTask, gtasksCreateTaskSchema,
  gtasksCompleteTask, gtasksCompleteTaskSchema,
} from './tools/google-tasks.js'
import {
  getMyJiraIssues, getMyJiraIssuesSchema,
  getJiraIssue, getJiraIssueSchema,
  searchJiraIssues, searchJiraIssuesSchema,
  createJiraIssue, createJiraIssueSchema,
  addJiraComment, addJiraCommentSchema,
  transitionJiraIssue, transitionJiraIssueSchema,
  getJiraTransitions, getJiraTransitionsSchema,
  summarizeSprint, summarizeSprintSchema,
} from './tools/jira.js'
import {
  checkLinear, checkLinearSchema,
  getLinearIssue, getLinearIssueSchema,
  searchLinear, searchLinearSchema,
  createLinearIssue, createLinearIssueSchema,
  commentLinear, commentLinearSchema,
  transitionLinear, transitionLinearSchema,
  getLinearStates, getLinearStatesSchema,
  summarizeCycle, summarizeCycleSchema,
  listLinearProjects, listLinearProjectsSchema,
  listLinearTeams, listLinearTeamsSchema,
  getLinearCycles, getLinearCyclesSchema,
  createLinearProject, createLinearProjectSchema,
  assignLinearIssue, assignLinearIssueSchema,
  listLinearLabels, listLinearLabelsSchema,
} from './tools/linear.js'
import {
  checkSocialComments, checkSocialCommentsSchema,
  replySocialComment, replySocialCommentSchema,
  createSocialPost, createSocialPostSchema,
  generateContentIdeasHandler, generateContentIdeasSchema,
  listSocialPosts, listSocialPostsSchema,
  manageReplyRules, manageReplyRulesSchema,
  listWorkshopBoardsHandler, listWorkshopBoardsSchema,
  listWorkshopCardsHandler, listWorkshopCardsSchema,
  createWorkshopCardHandler, createWorkshopCardSchema,
  updateWorkshopCardHandler, updateWorkshopCardSchema,
  deleteWorkshopCardHandler, deleteWorkshopCardSchema,
} from './tools/social.js'
import {
  listGithubRepos, listGithubReposSchema,
  listPullRequests, listPullRequestsSchema,
  getPullRequest, getPullRequestSchema,
  commentOnPullRequest, commentOnPullRequestSchema,
  listGithubBranches, listGithubBranchesSchema,
  getPrChanges, getPrChangesSchema,
  createPullRequest, createPullRequestSchema,
} from './tools/github.js'

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
          description: 'PREFERRED tool for personal info. Update user profile section: identity (name, job, company), technical (skills, languages), interests (hobbies), communication (tone prefs), work_patterns (schedule). Use this instead of save_memory for anything about the user.',
          schema: updateProfileSchema.shape,
          handler: (args) => updateProfileHandler(args),
        },
        {
          name: 'save_instruction',
          description: 'Save a rule the user wants you to follow. Use when user says "remember to always X" or "never do Y".',
          schema: saveInstructionSchema.shape,
          handler: (args) => saveInstructionHandler(args),
        },
        {
          name: 'save_memory',
          description: 'Save a fact or context that does NOT fit in profile sections. Use for project details, one-off facts, external context. Do NOT use for personal info like name/job/skills — use update_profile instead.',
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
          description: 'Create a recurring scheduled task (cron job). The bot will run the prompt at the specified schedule and send you the result.',
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
          description: 'Render COMPLETE HTML/CSS/JS to the live canvas. Call ONCE with all content — never call multiple times.',
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
          description: 'Fetch unread emails from the last N days. Returns sender, subject, snippet, date for each email.',
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
          description: 'Search emails using Gmail search syntax (e.g. "from:john subject:meeting", "is:unread", "newer_than:2d").',
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
          description: 'Create a new calendar event with summary, time, attendees, and location. NEVER create without user confirmation.',
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
          description: 'Read the text content of a Google Drive file. Google Docs are exported as plain text, Sheets as CSV.',
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

    // 11. jira
    {
      id: 'jira',
      label: 'Jira',
      tools: [
        {
          name: 'check_jira',
          description: 'List my assigned Jira issues. Optionally pass a JQL query to customize.',
          schema: getMyJiraIssuesSchema.shape,
          handler: (args) => getMyJiraIssues(args),
        },
        {
          name: 'get_jira_issue',
          description: 'Get full details of a Jira issue by key (e.g. PROJ-123).',
          schema: getJiraIssueSchema.shape,
          handler: (args) => getJiraIssue(args),
        },
        {
          name: 'search_jira',
          description: 'Search Jira issues using JQL query.',
          schema: searchJiraIssuesSchema.shape,
          handler: (args) => searchJiraIssues(args),
        },
        {
          name: 'create_jira_issue',
          description: 'Create a new Jira issue. NEVER create without user confirmation.',
          schema: createJiraIssueSchema.shape,
          handler: (args) => createJiraIssue(args),
        },
        {
          name: 'comment_jira',
          description: 'Add a comment to a Jira issue.',
          schema: addJiraCommentSchema.shape,
          handler: (args) => addJiraComment(args),
        },
        {
          name: 'transition_jira',
          description: 'Move a Jira issue to a different status (e.g. In Progress, Done).',
          schema: transitionJiraIssueSchema.shape,
          handler: (args) => transitionJiraIssue(args),
        },
        {
          name: 'get_jira_transitions',
          description: 'List available status transitions for a Jira issue.',
          schema: getJiraTransitionsSchema.shape,
          handler: (args) => getJiraTransitions(args),
        },
        {
          name: 'summarize_sprint',
          description: 'Summarize the current active sprint — total issues and breakdown by status.',
          schema: summarizeSprintSchema.shape,
          handler: () => summarizeSprint(),
        },
      ],
    },

    // 12. linear
    {
      id: 'linear',
      label: 'Linear',
      tools: [
        {
          name: 'check_linear',
          description: 'List my assigned Linear issues. Optionally filter by team.',
          schema: checkLinearSchema.shape,
          handler: (args) => checkLinear(args),
        },
        {
          name: 'get_linear_issue',
          description: 'Get full details of a Linear issue by identifier (e.g. ENG-123).',
          schema: getLinearIssueSchema.shape,
          handler: (args) => getLinearIssue(args),
        },
        {
          name: 'search_linear',
          description: 'Search Linear issues with text query and filters (team, state, label, assignee, project).',
          schema: searchLinearSchema.shape,
          handler: (args) => searchLinear(args),
        },
        {
          name: 'create_linear_issue',
          description: 'Create a new Linear issue. NEVER create without user confirmation.',
          schema: createLinearIssueSchema.shape,
          handler: (args) => createLinearIssue(args),
        },
        {
          name: 'comment_linear',
          description: 'Add a comment to a Linear issue.',
          schema: commentLinearSchema.shape,
          handler: (args) => commentLinear(args),
        },
        {
          name: 'transition_linear',
          description: 'Move a Linear issue to a different workflow state.',
          schema: transitionLinearSchema.shape,
          handler: (args) => transitionLinear(args),
        },
        {
          name: 'get_linear_states',
          description: 'List available workflow states for a Linear team.',
          schema: getLinearStatesSchema.shape,
          handler: (args) => getLinearStates(args),
        },
        {
          name: 'summarize_linear_cycle',
          description: 'Summarize the active Linear cycle — progress, total issues, breakdown by status.',
          schema: summarizeCycleSchema.shape,
          handler: (args) => summarizeCycle(args),
        },
        {
          name: 'list_linear_projects',
          description: 'List Linear projects with progress percentage, lead, and dates.',
          schema: listLinearProjectsSchema.shape,
          handler: (args) => listLinearProjects(args),
        },
        {
          name: 'list_linear_teams',
          description: 'List all teams in the Linear workspace.',
          schema: listLinearTeamsSchema.shape,
          handler: () => listLinearTeams(),
        },
        {
          name: 'get_linear_cycles',
          description: 'Get cycles for a Linear team (active and optionally completed).',
          schema: getLinearCyclesSchema.shape,
          handler: (args) => getLinearCycles(args),
        },
        {
          name: 'create_linear_project',
          description: 'Create a new Linear project. NEVER create without user confirmation.',
          schema: createLinearProjectSchema.shape,
          handler: (args) => createLinearProject(args),
        },
        {
          name: 'assign_linear_issue',
          description: 'Change or remove the assignee of a Linear issue.',
          schema: assignLinearIssueSchema.shape,
          handler: (args) => assignLinearIssue(args),
        },
        {
          name: 'list_linear_labels',
          description: 'List labels for a Linear team.',
          schema: listLinearLabelsSchema.shape,
          handler: (args) => listLinearLabels(args),
        },
      ],
    },

    // 13. github
    {
      id: 'github',
      label: 'GitHub',
      tools: [
        {
          name: 'list_github_repos',
          description: 'List GitHub repositories accessible to the authenticated user',
          schema: listGithubReposSchema.shape,
          handler: (args) => listGithubRepos(args),
        },
        {
          name: 'list_pull_requests',
          description: 'List pull requests for a GitHub repository',
          schema: listPullRequestsSchema.shape,
          handler: (args) => listPullRequests(args),
        },
        {
          name: 'get_pull_request',
          description: 'Get full details of a GitHub pull request',
          schema: getPullRequestSchema.shape,
          handler: (args) => getPullRequest(args),
        },
        {
          name: 'comment_pull_request',
          description: 'Add a comment to a GitHub pull request',
          schema: commentOnPullRequestSchema.shape,
          handler: (args) => commentOnPullRequest(args),
        },
        {
          name: 'list_github_branches',
          description: 'List branches in a GitHub repository',
          schema: listGithubBranchesSchema.shape,
          handler: (args) => listGithubBranches(args),
        },
        {
          name: 'get_pr_changes',
          description: 'Get file changes (diff) of a GitHub pull request',
          schema: getPrChangesSchema.shape,
          handler: (args) => getPrChanges(args),
        },
        {
          name: 'create_pull_request',
          description: 'Create a new pull request on GitHub. NEVER create without user confirmation.',
          schema: createPullRequestSchema.shape,
          handler: (args) => createPullRequest(args),
        },
      ],
    },

    // 14. social
    {
      id: 'social',
      label: 'Social Media',
      tools: [
        {
          name: 'check_social_comments',
          description: 'List recent comments across social platforms, optionally filtered by status (pending/flagged)',
          schema: checkSocialCommentsSchema.shape,
          handler: (args) => checkSocialComments(args),
        },
        {
          name: 'reply_social_comment',
          description: 'Reply to a specific social media comment. NEVER reply without user confirmation.',
          schema: replySocialCommentSchema.shape,
          handler: (args) => replySocialComment(args),
        },
        {
          name: 'create_social_post',
          description: 'Create a draft or schedule a post on Instagram, X, or YouTube. NEVER post without user confirmation.',
          schema: createSocialPostSchema.shape,
          handler: (args) => createSocialPost(args),
        },
        {
          name: 'generate_content_ideas',
          description: 'Generate AI content ideas for a social media platform',
          schema: generateContentIdeasSchema.shape,
          handler: (args) => generateContentIdeasHandler(args),
        },
        {
          name: 'list_social_posts',
          description: 'List recent social media posts with engagement stats',
          schema: listSocialPostsSchema.shape,
          handler: (args) => listSocialPosts(args),
        },
        {
          name: 'manage_reply_rules',
          description: 'Add, edit, delete, or list auto-reply rules for social media comments',
          schema: manageReplyRulesSchema.shape,
          handler: (args) => manageReplyRules(args),
        },
        {
          name: 'list_workshop_boards',
          description: 'List all content workshop boards',
          schema: listWorkshopBoardsSchema.shape,
          handler: () => listWorkshopBoardsHandler(),
        },
        {
          name: 'list_workshop_cards',
          description: 'List all cards on a workshop board with their column, title, description, and notes',
          schema: listWorkshopCardsSchema.shape,
          handler: (args) => listWorkshopCardsHandler(args),
        },
        {
          name: 'create_workshop_card',
          description: 'Create a new card on a workshop board. Use to capture content ideas, drafts, or plans.',
          schema: createWorkshopCardSchema.shape,
          handler: (args) => createWorkshopCardHandler(args),
        },
        {
          name: 'update_workshop_card',
          description: 'Update an existing workshop card — change title, description, column, tags, or add AI notes',
          schema: updateWorkshopCardSchema.shape,
          handler: (args) => updateWorkshopCardHandler(args),
        },
        {
          name: 'delete_workshop_card',
          description: 'Delete a workshop card by ID',
          schema: deleteWorkshopCardSchema.shape,
          handler: (args) => deleteWorkshopCardHandler(args),
        },
      ],
    },
  ]
}
