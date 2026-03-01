export interface GitLabProject {
  id: number
  name: string
  path_with_namespace: string
  web_url: string
  default_branch: string
}

export interface GitLabUser {
  id: number
  username: string
  name: string
  avatar_url: string
}

export interface GitLabMergeRequest {
  id: number
  iid: number
  title: string
  description: string | null
  state: 'opened' | 'closed' | 'merged' | 'locked'
  source_branch: string
  target_branch: string
  author: GitLabUser
  reviewers: GitLabUser[]
  labels: string[]
  draft: boolean
  web_url: string
  created_at: string
  updated_at: string
  merged_at: string | null
  user_notes_count: number
  has_conflicts: boolean
  merge_status: string
  approvals_before_merge: number | null
}

export interface GitLabMRChange {
  old_path: string
  new_path: string
  diff: string
  new_file: boolean
  renamed_file: boolean
  deleted_file: boolean
}

export interface GitLabDiffRefs {
  base_sha: string
  start_sha: string
  head_sha: string
}

export interface GitLabLineRangeRef {
  line_code: string
  type: 'new' | 'old'
}

export interface GitLabDiffPosition {
  base_sha: string
  start_sha: string
  head_sha: string
  position_type: 'text'
  old_path: string
  new_path: string
  old_line: number | null
  new_line: number | null
  line_range?: {
    start: GitLabLineRangeRef
    end: GitLabLineRangeRef
  }
}

export interface PendingComment {
  id: string
  filePath: string
  oldPath: string
  body: string
  lineType: 'new' | 'old'
  startLine: number
  endLine: number
  oldLine: number | null
  newLine: number | null
}

export interface GitLabNote {
  id: number
  body: string
  author: GitLabUser
  system: boolean
  resolvable: boolean
  resolved: boolean
  type: string | null
  position: GitLabDiffPosition | null
  created_at: string
  updated_at: string
}

export interface GitLabApprovalState {
  approved: boolean
  approved_by: Array<{ user: GitLabUser }>
  approvals_required: number
  approvals_left: number
}

export interface CreateMRPayload {
  source_branch: string
  target_branch: string
  title: string
  description?: string
  labels?: string
  reviewer_ids?: number[]
  squash?: boolean
  remove_source_branch?: boolean
}

export interface GitLabContributor {
  name: string
  emails: string[]
  commits: number
}

export interface GitLabBranch {
  name: string
  default: boolean
  merged: boolean
  protected: boolean
}

export interface PRAgentItem {
  severity: 'critical' | 'warning' | 'suggestion' | 'info'
  title: string
  file?: string
  line?: number
  body: string
  suggestion?: string
}

export interface PRAgentResult {
  tool: 'review' | 'describe' | 'improve' | 'ask'
  summary: string
  items: PRAgentItem[]
  rawOutput?: string
}