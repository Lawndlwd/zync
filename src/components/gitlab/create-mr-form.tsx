import { useState, useCallback } from 'react'
import { useGitlabBranches, useCreateMR } from '@/hooks/useGitlab'
import { fetchBranchCompare } from '@/services/gitlab'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Bot, Loader2, GitMerge } from 'lucide-react'
import toast from 'react-hot-toast'

interface CreateMRFormProps {
  projectId: number
  defaultBranch: string
  open: boolean
  onClose: () => void
}

export function CreateMRForm({ projectId, defaultBranch, open, onClose }: CreateMRFormProps) {
  const [sourceBranch, setSourceBranch] = useState('')
  const [targetBranch, setTargetBranch] = useState(defaultBranch)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const { data: branches } = useGitlabBranches(projectId)
  const createMR = useCreateMR()

  const generateWithAI = useCallback(async () => {
    if (!sourceBranch || !targetBranch) {
      toast.error('Select source and target branches first')
      return
    }

    setIsGenerating(true)
    try {
      // Get diff between branches
      const comparison = await fetchBranchCompare(projectId, targetBranch, sourceBranch)
      const diffsText = comparison.diffs
        .map((d) => `=== ${d.new_path} ===\n${d.diff}`)
        .join('\n\n')
      const commitsText = comparison.commits
        .map((c: any) => `- ${c.title || c.message}`)
        .join('\n')

      const prompt = `Based on the following git diff and commit history, generate a merge request title and description.

Commits:
${commitsText}

Diff:
${diffsText}

Respond with JSON: {"title": "...", "description": "..."}.
The title should be concise (max 72 chars). The description should use markdown with sections: ## Summary, ## Changes, ## Testing.`

      const response = await fetch('/api/llm/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You generate concise, professional merge request descriptions.' },
            { role: 'user', content: prompt },
          ],
          agentId: 'codeReview',
        }),
      })

      if (!response.ok) throw new Error('LLM request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
      }

      const jsonMatch = buffer.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.title) setTitle(parsed.title)
        if (parsed.description) setDescription(parsed.description)
        toast.success('AI generated MR details')
      }
    } catch (err: any) {
      toast.error(err.message || 'AI generation failed')
    } finally {
      setIsGenerating(false)
    }
  }, [projectId, sourceBranch, targetBranch])

  const handleSubmit = async () => {
    if (!sourceBranch || !title.trim()) {
      toast.error('Source branch and title are required')
      return
    }
    try {
      const mrTitle = draft ? `Draft: ${title}` : title
      await createMR.mutateAsync({
        projectId,
        payload: {
          source_branch: sourceBranch,
          target_branch: targetBranch,
          title: mrTitle,
          description: description || undefined,
          remove_source_branch: true,
        },
      })
      toast.success('Merge request created')
      onClose()
    } catch {
      toast.error('Failed to create merge request')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge size={18} />
            Create Merge Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-zinc-400">Source Branch</Label>
            <select
              value={sourceBranch}
              onChange={(e) => setSourceBranch(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-zinc-100"
            >
              <option value="">Select branch...</option>
              {branches?.map((b) => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-xs text-zinc-400">Target Branch</Label>
            <select
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-zinc-100"
            >
              {branches?.map((b) => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={draft}
                onChange={(e) => setDraft(e.target.checked)}
                className="rounded border-white/[0.1]"
              />
              Draft MR
            </label>
            <Button
              size="sm"
              variant="ghost"
              onClick={generateWithAI}
              disabled={isGenerating || !sourceBranch}
            >
              {isGenerating ? (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <Bot size={14} className="mr-1.5" />
              )}
              Generate with AI
            </Button>
          </div>

          <div>
            <Label className="text-xs text-zinc-400">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="MR title"
            />
          </div>

          <div>
            <Label className="text-xs text-zinc-400">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="MR description (markdown supported)"
              rows={6}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMR.isPending || !sourceBranch || !title.trim()}>
            {createMR.isPending ? 'Creating...' : 'Create MR'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
