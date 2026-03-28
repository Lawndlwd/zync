import { Text } from '@blocksuite/store'
import type { GoalGranularity, LifeOsGoal } from '@zync/shared/types'
import { useEffect, useRef } from 'react'
import { useEditor } from '@/components/blocksuite/editor/context'

const GRANULARITY_LABELS: Record<string, string> = {
  year: 'Months',
  month: 'Weeks',
  week: 'Days',
}

// Column IDs (stable across syncs)
const COL_TITLE = 'col-title'
const COL_DATES = 'col-dates'
const COL_PROGRESS = 'col-progress'
const COL_STATUS = 'col-status'
const COL_GOALID = 'col-goalid'

function buildColumns() {
  return [
    { id: COL_TITLE, type: 'title', name: 'Title', data: {} },
    { id: COL_DATES, type: 'rich-text', name: 'Dates', data: {} },
    { id: COL_PROGRESS, type: 'progress', name: 'Progress', data: {} },
    { id: COL_STATUS, type: 'rich-text', name: 'Status', data: {} },
    { id: COL_GOALID, type: 'rich-text', name: '_goalId', data: {} },
  ]
}

function buildTableView() {
  return {
    id: 'view-table',
    name: 'Table View',
    mode: 'table',
    columns: [
      { id: COL_TITLE, width: 200 },
      { id: COL_DATES, width: 150 },
      { id: COL_PROGRESS, width: 100 },
      { id: COL_STATUS, width: 100 },
      { id: COL_GOALID, width: 0, hide: true },
    ],
    filter: { type: 'group', op: 'and', conditions: [] },
    header: { titleColumn: COL_TITLE },
  }
}

interface SyncOpts {
  goalId: string
  granularity: GoalGranularity
  children: LifeOsGoal[]
  onNavigate: (goalId: string) => void
}

export function useGoalDatabaseSync({ goalId, granularity, children, onNavigate }: SyncOpts) {
  const editorCtx = useEditor()
  const syncedRef = useRef<string | null>(null)
  const navigateRef = useRef(onNavigate)
  navigateRef.current = onNavigate
  // Map: rowBlockId → goalId for navigation
  const rowGoalMapRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    const editor = editorCtx?.editor
    if (!editor?.doc) return
    if (granularity === 'day') return
    if (children.length === 0) return

    const syncKey = `${goalId}:${children.map((c) => `${c.id}:${c.progress}:${c.status}`).join(',')}`
    if (syncedRef.current === syncKey) return

    const doc = editor.doc
    const pageBlock = doc.root
    if (!pageBlock) return
    const noteBlock = pageBlock.children.find((b: any) => b.flavour === 'affine:note')
    if (!noteBlock) return

    try {
      // Find existing database block
      const dbBlock = noteBlock.children.find((b: any) => b.flavour === 'affine:database') as any

      if (dbBlock) {
        // Database exists — update rows via model API
        updateExistingDatabase(doc, dbBlock, children)
      } else {
        // Create new database with all data pre-populated
        createFreshDatabase(doc, noteBlock, granularity, children)
      }

      syncedRef.current = syncKey
    } catch (err) {
      console.warn('[GoalDatabaseSync] Sync error:', err)
    }
  }, [editorCtx?.editor, editorCtx?.editor?.doc, goalId, granularity, children])

  function createFreshDatabase(doc: any, noteBlock: any, gran: GoalGranularity, kids: LifeOsGoal[]) {
    const dbId = doc.addBlock(
      'affine:database' as any,
      {
        title: new Text(GRANULARITY_LABELS[gran] || 'Sub-goals'),
        columns: buildColumns(),
        cells: {},
        views: [buildTableView()],
      },
      noteBlock.id,
    )

    if (!dbId) return

    const dbModel = doc.getBlockById(dbId) as any
    const rowMap = new Map<string, string>()

    kids.forEach((child) => {
      const rowId = doc.addBlock(
        'affine:paragraph' as any,
        {
          text: new Text(child.title),
        },
        dbId,
      )
      if (rowId && dbModel?.updateCell) {
        rowMap.set(rowId, child.id)
        try {
          dbModel.updateCell(rowId, { columnId: COL_DATES, value: new Text(`${child.startDate} — ${child.endDate}`) })
          dbModel.updateCell(rowId, { columnId: COL_PROGRESS, value: child.progress })
          dbModel.updateCell(rowId, { columnId: COL_STATUS, value: new Text(child.status || 'active') })
          dbModel.updateCell(rowId, { columnId: COL_GOALID, value: new Text(child.id) })
        } catch {
          /* ok */
        }
      }
    })
    rowGoalMapRef.current = rowMap
  }

  function updateExistingDatabase(doc: any, dbBlock: any, kids: LifeOsGoal[]) {
    const dbModel = dbBlock as any
    const existingChildren = dbModel.children || []

    // Rebuild map from existing rows by reading the hidden _goalId column
    const rowMap = new Map<string, string>()
    for (const row of existingChildren) {
      try {
        const cells = dbModel.cells?.[row.id]
        const goalIdCell = cells?.[COL_GOALID]
        const storedGoalId = goalIdCell?.value?.toString?.() || ''
        if (storedGoalId) {
          rowMap.set(row.id, storedGoalId)
        }
      } catch {
        /* ok */
      }
    }

    // For any kids not already in the database, add new rows
    const mappedGoalIds = new Set(rowMap.values())
    for (const child of kids) {
      if (!mappedGoalIds.has(child.id)) {
        const rowId = doc.addBlock(
          'affine:paragraph' as any,
          {
            text: new Text(child.title),
          },
          dbModel.id,
        )
        if (rowId) {
          rowMap.set(rowId, child.id)
          if (dbModel.updateCell) {
            try {
              dbModel.updateCell(rowId, {
                columnId: COL_DATES,
                value: new Text(`${child.startDate} — ${child.endDate}`),
              })
              dbModel.updateCell(rowId, { columnId: COL_PROGRESS, value: child.progress })
              dbModel.updateCell(rowId, { columnId: COL_STATUS, value: new Text(child.status || 'active') })
              dbModel.updateCell(rowId, { columnId: COL_GOALID, value: new Text(child.id) })
            } catch {
              /* ok */
            }
          }
        }
      }
    }

    // Update progress/status for existing rows
    for (const [rowId, goalId] of rowMap) {
      const child = kids.find((k) => k.id === goalId)
      if (child && dbModel.updateCell) {
        try {
          dbModel.updateCell(rowId, { columnId: COL_PROGRESS, value: child.progress })
          dbModel.updateCell(rowId, { columnId: COL_STATUS, value: new Text(child.status || 'active') })
        } catch {
          /* ok */
        }
      }
    }

    rowGoalMapRef.current = rowMap
  }

  // Navigation: double-click on database rows
  useEffect(() => {
    const editor = editorCtx?.editor
    if (!editor?.doc || granularity === 'day') return

    const handleDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const dbEl = target.closest('affine-database')
      if (!dbEl) return

      // Find the row block ID from the DOM
      const rowMap = rowGoalMapRef.current
      if (rowMap.size === 0) return

      // Try to find the row element
      const doc = editor.doc
      if (!doc?.root) return
      const noteBlock = doc.root.children.find((b: any) => b.flavour === 'affine:note')
      const dbModel = noteBlock?.children.find((b: any) => b.flavour === 'affine:database') as any
      if (!dbModel?.children) return

      // Find row index from DOM position
      const allRowEls = dbEl.querySelectorAll('.affine-database-block-row, [data-row-index]')
      let clickedIdx = -1
      for (let i = 0; i < allRowEls.length; i++) {
        if (allRowEls[i].contains(target)) {
          clickedIdx = i
          break
        }
      }

      if (clickedIdx >= 0 && clickedIdx < dbModel.children.length) {
        const rowBlockId = dbModel.children[clickedIdx].id
        const goalId = rowMap.get(rowBlockId)
        if (goalId) {
          e.preventDefault()
          e.stopPropagation()
          navigateRef.current(goalId)
        }
      }
    }

    const container = document.querySelector('.blocksuite-editor-container') as HTMLElement | null
    if (container) {
      container.addEventListener('dblclick', handleDblClick, true)
      return () => container.removeEventListener('dblclick', handleDblClick, true)
    }
  }, [editorCtx?.editor, editorCtx?.editor?.doc, granularity])
}
