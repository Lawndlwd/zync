import { useState, useMemo } from 'react'
import type { JiraIssue } from '@/types/jira'
import type { AttachmentMap } from '@/lib/jira-markup'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { useJiraTransitions, useTransitionIssue, useAddComment } from '@/hooks/useJiraIssues'
import { useChatStore } from '@/store/chat'
import { MarkdownContent } from '@/components/ui/markdown'
import {
  Bot,
  ExternalLink,
  Send,
  X,
  Clock,
  User,
  Tag,
  Zap,
  MessageCircle,
  ArrowRight,
} from 'lucide-react'
import { formatDate, relativeTime } from '@/lib/utils'
import { Link } from 'react-router-dom'

const statusVariant = (category: string) => {
  switch (category) {
    case 'done':
      return 'success' as const
    case 'indeterminate':
      return 'primary' as const
    default:
      return 'default' as const
  }
}

const priorityVariant = (name: string) => {
  switch (name.toLowerCase()) {
    case 'highest':
    case 'critical':
      return 'danger' as const
    case 'high':
      return 'warning' as const
    case 'medium':
      return 'info' as const
    default:
      return 'default' as const
  }
}

interface IssueDetailProps {
  issue: JiraIssue
  jiraBaseUrl: string
  onClose: () => void
}

export function IssueDetail({ issue, jiraBaseUrl, onClose }: IssueDetailProps) {
  const [comment, setComment] = useState('')
  const { data: transitions } = useJiraTransitions(issue.key)
  const transitionMutation = useTransitionIssue()
  const commentMutation = useAddComment()
  const openChat = useChatStore((s) => s.openChat)

  const handleTransition = (transitionId: string) => {
    transitionMutation.mutate({ issueKey: issue.key, transitionId })
  }

  const handleComment = () => {
    if (!comment.trim()) return
    commentMutation.mutate({ issueKey: issue.key, body: comment })
    setComment('')
  }

  // Build filename → proxied URL map for resolving !image! in Jira markup
  const attachmentMap = useMemo<AttachmentMap>(() => {
    const map: AttachmentMap = {}
    for (const a of issue.attachments || []) {
      map[a.filename] = a.contentUrl
    }
    return map
  }, [issue.attachments])

  const handleAIChecklist = () => {
    openChat()
    useChatStore.getState().addMessage(
      'user',
      `Generate a structured TODO checklist for Jira issue ${issue.key}: "${issue.summary}". ${issue.description ? `Description: ${issue.description}` : ''}`
    )
  }

  return (
    <div className="fixed inset-0 z-40">
      <ResizablePanelGroup orientation="horizontal">
        {/* Invisible spacer panel — clicking it closes the detail */}
        <ResizablePanel
          defaultSize="60%"
          minSize="15%"
          onClick={onClose}
          className="cursor-pointer"
        />
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="40%" minSize="320px" maxSize="85%">
          <div className="flex h-full flex-col bg-[#1a1d1e]/95 backdrop-blur-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <Link to={`https://jira.infra.online.net/browse/${issue.key}`} className="shrink-0 rounded bg-indigo-500/15 px-3 py-0.5 text-sm font-mono font-semibold text-indigo-400">
                  {issue.key}
                </Link>
                <Badge variant={statusVariant(issue.status.category)}>{issue.status.name}</Badge>
                <Badge variant={priorityVariant(issue.priority.name)}>{issue.priority.name}</Badge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => window.open(`${jiraBaseUrl}/browse/${issue.key}`, '_blank')}
                  title="Open in Jira"
                >
                  <ExternalLink size={18} />
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X size={18} />
                </Button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Title + description */}
              <div className="border-b border-white/[0.05] px-5 py-5">
                <h2 className="text-base font-semibold text-zinc-100 leading-snug">{issue.summary}</h2>

                {issue.description && (
                  <div className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 text-base text-zinc-300 leading-relaxed overflow-hidden">
                    <MarkdownContent attachments={attachmentMap}>{issue.description}</MarkdownContent>
                  </div>
                )}

                <div className="mt-4 flex gap-3">
                  <Button variant="secondary" size="sm" onClick={handleAIChecklist}>
                    <Bot size={18} />
                    AI Checklist
                  </Button>
                  {jiraBaseUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`${jiraBaseUrl}/browse/${issue.key}`, '_blank')}
                    >
                      <ExternalLink size={18} />
                      Open in Jira
                    </Button>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="border-b border-white/[0.05] px-5 py-4">
                <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                  <MetaField icon={<User size={16} />} label="Assignee">
                    <div className="flex items-center gap-3">
                      {issue.assignee ? (
                        <>
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-400">
                            {issue.assignee.displayName.charAt(0)}
                          </div>
                          <span>{issue.assignee.displayName}</span>
                        </>
                      ) : (
                        <span className="text-zinc-500">Unassigned</span>
                      )}
                    </div>
                  </MetaField>

                  <MetaField icon={<User size={16} />} label="Reporter">
                    <div className="flex items-center gap-3">
                      {issue.reporter ? (
                        <>
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.1] text-xs font-semibold text-zinc-300">
                            {issue.reporter.displayName.charAt(0)}
                          </div>
                          <span>{issue.reporter.displayName}</span>
                        </>
                      ) : (
                        <span className="text-zinc-500">Unknown</span>
                      )}
                    </div>
                  </MetaField>

                  {issue.sprint && (
                    <MetaField icon={<Zap size={16} />} label="Sprint">
                      {issue.sprint.name}
                    </MetaField>
                  )}

                  <MetaField icon={<Clock size={16} />} label="Updated">
                    {relativeTime(issue.updated)}
                  </MetaField>

                  {issue.labels.length > 0 && (
                    <div className="col-span-2">
                      <MetaField icon={<Tag size={16} />} label="Labels">
                        <div className="flex flex-wrap gap-2">
                          {issue.labels.map((l) => (
                            <Badge key={l} variant="default">{l}</Badge>
                          ))}
                        </div>
                      </MetaField>
                    </div>
                  )}
                </div>
              </div>

              {/* Transitions */}
              {transitions?.transitions && transitions.transitions.length > 0 && (
                <div className="border-b border-white/[0.05] px-5 py-4">
                  <SectionTitle icon={<ArrowRight size={16} />}>Transition</SectionTitle>
                  <div className="flex flex-wrap gap-3">
                    {transitions.transitions.map((t) => (
                      <Button
                        key={t.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleTransition(t.id)}
                        disabled={transitionMutation.isPending}
                      >
                        <ArrowRight size={16} />
                        {t.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div className="px-5 py-4">
                <SectionTitle icon={<MessageCircle size={16} />}>
                  Comments {issue.comments.length > 0 && `(${issue.comments.length})`}
                </SectionTitle>

                {issue.comments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/[0.08] py-6 text-center">
                    <MessageCircle size={20} className="mx-auto mb-2 text-zinc-700" />
                    <p className="text-sm text-zinc-500">No comments yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {issue.comments.map((c) => (
                      <div key={c.id} className="group relative">
                        <div className="flex gap-3">
                          {/* Avatar */}
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-sm font-semibold text-zinc-300">
                            {c.author.displayName.charAt(0).toUpperCase()}
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-3">
                              <span className="text-sm font-semibold text-zinc-200">
                                {c.author.displayName}
                              </span>
                              <span className="text-sm text-zinc-600" title={formatDate(c.created)}>
                                {relativeTime(c.created)}
                              </span>
                            </div>
                            <div className="mt-1 rounded-lg rounded-tl-none bg-white/[0.05] px-3 py-2 text-base text-zinc-300 leading-relaxed overflow-hidden">
                              <MarkdownContent attachments={attachmentMap}>{c.body}</MarkdownContent>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comment input — pinned at bottom */}
            <div className="border-t border-white/[0.08] px-5 py-3">
              <div className="flex gap-3">
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment..."
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleComment()}
                  className="text-base"
                />
                <Button
                  size="icon"
                  onClick={handleComment}
                  disabled={!comment.trim() || commentMutation.isPending}
                >
                  <Send size={18} />
                </Button>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
      {icon}
      {children}
    </div>
  )
}

function MetaField({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="text-base text-zinc-300">{children}</div>
    </div>
  )
}
