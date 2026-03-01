import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Combobox } from '@/components/ui/combobox'
import type { ComboboxOption } from '@/components/ui/combobox'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { useProjectMeta, useSearchUsers, useCreateIssue, useCreateFields, useProjects, useUploadAttachments } from '@/hooks/useJiraIssues'
import { useSettingsStore } from '@/store/settings'
import type { CreateIssueFormState, JiraFieldMeta } from '@/types/jira'
import { X, Loader2, Paperclip, FileIcon } from 'lucide-react'

interface CreateIssueFormProps {
  projectKey: string
  initialValues?: Partial<CreateIssueFormState>
  onClose: () => void
  onCreated: (issueKey: string) => void
}

const emptyState: CreateIssueFormState = {
  projectKey: '',
  issueTypeId: '',
  summary: '',
  description: '',
  priorityId: '',
  assigneeId: '',
  reporterId: '',
  labels: [],
  componentIds: [],
  fixVersionIds: [],
  customFields: {},
}

export function CreateIssueForm({
  projectKey,
  initialValues,
  onClose,
  onCreated,
}: CreateIssueFormProps) {
  const [form, setForm] = useState<CreateIssueFormState>({
    ...emptyState,
    projectKey,
    ...initialValues,
  })

  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [reporterSearch, setReporterSearch] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const email = useSettingsStore((s) => s.settings.jira.email)

  const { data: projects } = useProjects()
  const { data: meta, isLoading: metaLoading } = useProjectMeta(form.projectKey)
  const { data: dynamicFields, isLoading: fieldsLoading } = useCreateFields(form.projectKey, form.issueTypeId)
  const { data: assigneeUsers } = useSearchUsers(assigneeSearch, form.projectKey)
  const { data: reporterUsers } = useSearchUsers(reporterSearch, form.projectKey)
  const createMutation = useCreateIssue()
  const uploadMutation = useUploadAttachments()

  // Reset custom fields when issue type changes
  const prevIssueTypeRef = useRef(form.issueTypeId)
  useEffect(() => {
    if (prevIssueTypeRef.current !== form.issueTypeId) {
      prevIssueTypeRef.current = form.issueTypeId
      setForm((prev) => ({ ...prev, customFields: {} }))
    }
  }, [form.issueTypeId])

  // Default assignee/reporter from email on mount
  const defaultUserApplied = useRef(false)
  useEffect(() => {
    if (defaultUserApplied.current || !email) return
    const username = email.split('@')[0]
    if (username.length < 2) return
    defaultUserApplied.current = true
    setAssigneeSearch(username)
    setReporterSearch(username)
  }, [email])

  // Once user search results come back, auto-fill assignee/reporter if still empty
  const assigneeAutoFilled = useRef(false)
  useEffect(() => {
    if (assigneeAutoFilled.current || form.assigneeId) return
    if (assigneeUsers?.length) {
      assigneeAutoFilled.current = true
      setForm((prev) => ({ ...prev, assigneeId: assigneeUsers[0].accountId }))
    }
  }, [assigneeUsers, form.assigneeId])

  const reporterAutoFilled = useRef(false)
  useEffect(() => {
    if (reporterAutoFilled.current || form.reporterId) return
    if (reporterUsers?.length) {
      reporterAutoFilled.current = true
      setForm((prev) => ({ ...prev, reporterId: reporterUsers[0].accountId }))
    }
  }, [reporterUsers, form.reporterId])

  const update = useCallback(
    <K extends keyof CreateIssueFormState>(key: K, value: CreateIssueFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const projectOptions = useMemo<ComboboxOption[]>(
    () =>
      (projects || []).map((p) => ({
        value: p.key,
        label: `${p.key} — ${p.name}`,
        iconUrl: p.avatarUrl,
      })),
    [projects]
  )

  const issueTypeOptions = useMemo<ComboboxOption[]>(
    () =>
      (meta?.issueTypes || [])
        .filter((t) => !t.subtask)
        .map((t) => ({
          value: t.id,
          label: t.name,
          iconUrl: t.iconUrl,
        })),
    [meta?.issueTypes]
  )

  const priorityOptions = useMemo<ComboboxOption[]>(
    () =>
      (meta?.priorities || []).map((p) => ({
        value: p.id,
        label: p.name,
        iconUrl: p.iconUrl,
      })),
    [meta?.priorities]
  )

  const labelOptions = useMemo<ComboboxOption[]>(
    () =>
      (meta?.labels || []).map((l) => ({
        value: l,
        label: l,
      })),
    [meta?.labels]
  )

  const componentOptions = useMemo<ComboboxOption[]>(
    () =>
      (meta?.components || []).map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [meta?.components]
  )

  const versionOptions = useMemo<ComboboxOption[]>(
    () =>
      (meta?.versions || [])
        .filter((v) => !v.released)
        .map((v) => ({
          value: v.id,
          label: v.name,
        })),
    [meta?.versions]
  )

  const mapUsers = (users: typeof assigneeUsers): ComboboxOption[] =>
    (users || []).map((u) => ({
      value: u.accountId,
      label: u.displayName,
    }))

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length) {
      setAttachments((prev) => [...prev, ...files])
    }
    e.target.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (!form.summary.trim() || !form.issueTypeId) return
    // Build customFields payload — filter out empty values
    const customFieldsPayload: Record<string, any> = {}
    for (const [key, value] of Object.entries(form.customFields)) {
      if (value === '' || value === null || value === undefined) continue
      if (Array.isArray(value) && value.length === 0) continue
      customFieldsPayload[key] = value
    }

    createMutation.mutate(
      {
        projectKey: form.projectKey,
        issueTypeId: form.issueTypeId,
        summary: form.summary,
        description: form.description || undefined,
        priorityId: form.priorityId || undefined,
        assigneeId: form.assigneeId || undefined,
        reporterId: form.reporterId || undefined,
        labels: form.labels.length > 0 ? form.labels : undefined,
        componentIds: form.componentIds.length > 0 ? form.componentIds : undefined,
        fixVersionIds: form.fixVersionIds.length > 0 ? form.fixVersionIds : undefined,
        customFields: Object.keys(customFieldsPayload).length > 0 ? customFieldsPayload : undefined,
      },
      {
        onSuccess: (data) => {
          if (attachments.length > 0) {
            uploadMutation.mutate(
              { issueKey: data.key, files: attachments },
              {
                onSuccess: () => onCreated(data.key),
                onError: () => {
                  // Issue created but upload failed — still navigate
                  onCreated(data.key)
                },
              }
            )
          } else {
            onCreated(data.key)
          }
        },
      }
    )
  }

  const isUploading = uploadMutation.isPending
  const canSubmit = form.summary.trim() && form.issueTypeId && !createMutation.isPending && !isUploading

  return (
    <div className="fixed inset-0 z-40">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel
          defaultSize="55%"
          minSize="15%"
          onClick={onClose}
          className="cursor-pointer"
        />
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="45%" minSize="320px" maxSize="85%">
          <div className="flex h-full flex-col bg-[#1a1d1e]/95 backdrop-blur-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-100">
                Create Issue
              </h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X size={14} />
              </Button>
            </div>

            {/* Scrollable form */}
            <div className="flex-1 overflow-y-auto">
              {metaLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-zinc-500" />
                </div>
              ) : (
                <div className="space-y-6 px-5 py-5">
                  {/* Project */}
                  <FormSection title="Project">
                    <FormField label="Project" required>
                      <Combobox
                        options={projectOptions}
                        value={form.projectKey}
                        onChange={(v) => update('projectKey', v)}
                        placeholder="Select project..."
                      />
                    </FormField>
                  </FormSection>

                  {/* Basics */}
                  <FormSection title="Basics">
                    <FormField label="Issue Type" required>
                      <Combobox
                        options={issueTypeOptions}
                        value={form.issueTypeId}
                        onChange={(v) => update('issueTypeId', v)}
                        placeholder="Select issue type..."
                      />
                    </FormField>
                    <FormField label="Summary" required>
                      <Input
                        value={form.summary}
                        onChange={(e) => update('summary', e.target.value)}
                        placeholder="What needs to be done?"
                        autoFocus
                      />
                    </FormField>
                  </FormSection>

                  {/* Description */}
                  <FormSection title="Description">
                    <Textarea
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                      placeholder="Add a description... (plain text / wiki markup)"
                      rows={5}
                    />
                    <p className="text-[11px] text-zinc-600 mt-1">
                      Supports Jira wiki markup on Server, plain text on Cloud.
                    </p>
                  </FormSection>

                  {/* Details */}
                  <FormSection title="Details">
                    <FormField label="Priority">
                      <Combobox
                        options={priorityOptions}
                        value={form.priorityId}
                        onChange={(v) => update('priorityId', v)}
                        placeholder="Select priority..."
                      />
                    </FormField>
                    <FormField label="Labels">
                      <Combobox
                        multiple
                        creatable
                        options={labelOptions}
                        value={form.labels}
                        onChange={(v) => update('labels', v)}
                        placeholder="Select labels..."
                      />
                    </FormField>
                  </FormSection>

                  {/* People */}
                  <FormSection title="People">
                    <FormField label="Assignee">
                      <Combobox
                        options={mapUsers(assigneeUsers)}
                        value={form.assigneeId}
                        onChange={(v) => update('assigneeId', v)}
                        onSearch={setAssigneeSearch}
                        isLoading={assigneeSearch.length >= 2 && !assigneeUsers}
                        placeholder="Search for a user..."
                        searchPlaceholder="Type to search users..."
                      />
                    </FormField>
                    <FormField label="Reporter">
                      <Combobox
                        options={mapUsers(reporterUsers)}
                        value={form.reporterId}
                        onChange={(v) => update('reporterId', v)}
                        onSearch={setReporterSearch}
                        isLoading={reporterSearch.length >= 2 && !reporterUsers}
                        placeholder="Search for a user..."
                        searchPlaceholder="Type to search users..."
                      />
                    </FormField>
                  </FormSection>

                  {/* Planning */}
                  {(componentOptions.length > 0 || versionOptions.length > 0) && (
                    <FormSection title="Planning">
                      {componentOptions.length > 0 && (
                        <FormField label="Components">
                          <Combobox
                            multiple
                            options={componentOptions}
                            value={form.componentIds}
                            onChange={(v) => update('componentIds', v)}
                            placeholder="Select components..."
                          />
                        </FormField>
                      )}
                      {versionOptions.length > 0 && (
                        <FormField label="Fix Versions">
                          <Combobox
                            multiple
                            options={versionOptions}
                            value={form.fixVersionIds}
                            onChange={(v) => update('fixVersionIds', v)}
                            placeholder="Select versions..."
                          />
                        </FormField>
                      )}
                    </FormSection>
                  )}

                  {/* Dynamic Fields */}
                  {form.issueTypeId && dynamicFields && dynamicFields.length > 0 && (
                    <FormSection title="Additional Fields">
                      {fieldsLoading ? (
                        <div className="flex items-center gap-2 py-2 text-xs text-zinc-500">
                          <Loader2 size={14} className="animate-spin" />
                          Loading fields...
                        </div>
                      ) : (
                        dynamicFields.map((field) => (
                          <DynamicField
                            key={field.fieldId}
                            field={field}
                            value={form.customFields[field.fieldId]}
                            onChange={(val) =>
                              setForm((prev) => ({
                                ...prev,
                                customFields: { ...prev.customFields, [field.fieldId]: val },
                              }))
                            }
                          />
                        ))
                      )}
                    </FormSection>
                  )}

                  {/* Attachments */}
                  <FormSection title="Attachments">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-1.5"
                    >
                      <Paperclip size={14} />
                      Add files
                    </Button>
                    {attachments.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {attachments.map((file, i) => {
                          const isImage = file.type.startsWith('image/')
                          return (
                            <div
                              key={`${file.name}-${i}`}
                              className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5"
                            >
                              {isImage ? (
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={file.name}
                                  className="h-8 w-8 rounded object-cover"
                                />
                              ) : (
                                <FileIcon size={16} className="shrink-0 text-zinc-500" />
                              )}
                              <span className="flex-1 truncate text-xs text-zinc-300">
                                {file.name}
                              </span>
                              <span className="shrink-0 text-[10px] text-zinc-600">
                                {(file.size / 1024).toFixed(0)} KB
                              </span>
                              <button
                                type="button"
                                onClick={() => removeAttachment(i)}
                                className="shrink-0 rounded p-0.5 hover:bg-white/[0.1]"
                              >
                                <X size={12} className="text-zinc-500" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <p className="text-[11px] text-zinc-600 mt-1">
                      Files are uploaded after the issue is created.
                    </p>
                  </FormSection>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-3">
              {(createMutation.isError || uploadMutation.isError) && (
                <p className="text-xs text-red-400 truncate mr-3">
                  {(createMutation.error as Error)?.message ||
                    (uploadMutation.error as Error)?.message ||
                    'Failed to create issue'}
                </p>
              )}
              {!createMutation.isError && !uploadMutation.isError && <div />}
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                >
                  {createMutation.isPending || isUploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {isUploading ? 'Uploading...' : 'Creating...'}
                    </>
                  ) : (
                    'Create'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

function FormSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-zinc-400">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: JiraFieldMeta
  value: any
  onChange: (value: any) => void
}) {
  const { schema, allowedValues, name, required } = field
  const type = schema.type
  const items = schema.items
  const hasAllowed = allowedValues && allowedValues.length > 0

  const allowedOptions: ComboboxOption[] = useMemo(
    () =>
      (allowedValues || []).map((v) => ({
        value: String(v.id ?? v.value ?? v.name ?? ''),
        label: v.name || v.value || String(v.id) || '',
      })),
    [allowedValues]
  )

  // number → numeric input
  if (type === 'number') {
    return (
      <FormField label={name} required={required}>
        <Input
          type="number"
          value={value ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onChange(v === '' ? undefined : Number(v))
          }}
          placeholder={name}
        />
      </FormField>
    )
  }

  // option → single select with allowedValues
  if (type === 'option' && hasAllowed) {
    return (
      <FormField label={name} required={required}>
        <Combobox
          options={allowedOptions}
          value={value?.id ?? value ?? ''}
          onChange={(v) => onChange(v ? { id: v } : undefined)}
          placeholder={`Select ${name}...`}
        />
      </FormField>
    )
  }

  // array of options → multi select
  if (type === 'array' && items === 'option' && hasAllowed) {
    const currentValues = Array.isArray(value)
      ? value.map((v: any) => String(v.id ?? v))
      : []
    return (
      <FormField label={name} required={required}>
        <Combobox
          multiple
          options={allowedOptions}
          value={currentValues}
          onChange={(vals) => onChange(vals.map((id: string) => ({ id })))}
          placeholder={`Select ${name}...`}
        />
      </FormField>
    )
  }

  // array of strings (like labels-type fields)
  if (type === 'array' && items === 'string') {
    const currentValues = Array.isArray(value) ? value : []
    return (
      <FormField label={name} required={required}>
        <Combobox
          multiple
          creatable
          options={allowedOptions}
          value={currentValues}
          onChange={onChange}
          placeholder={`Select ${name}...`}
        />
      </FormField>
    )
  }

  // user type
  if (type === 'user') {
    return (
      <FormField label={name} required={required}>
        <Combobox
          options={hasAllowed ? allowedOptions : []}
          value={value?.name ?? value?.key ?? value ?? ''}
          onChange={(v) => onChange(v ? { name: v } : undefined)}
          placeholder={`Select ${name}...`}
        />
      </FormField>
    )
  }

  // any / string with allowedValues (sprint, epic link, etc.)
  if (hasAllowed) {
    return (
      <FormField label={name} required={required}>
        <Combobox
          options={allowedOptions}
          value={typeof value === 'object' ? String(value?.id ?? '') : String(value ?? '')}
          onChange={(v) => {
            if (!v) return onChange(undefined)
            // If allowedValues use numeric ids, send as number
            const original = allowedValues!.find(
              (av) => String(av.id ?? av.value ?? av.name) === v
            )
            if (original?.id !== undefined) {
              // Sprint uses plain id, epic uses key string
              onChange(typeof original.id === 'number' ? Number(v) : v)
            } else {
              onChange(v)
            }
          }}
          placeholder={`Select ${name}...`}
        />
      </FormField>
    )
  }

  // Default fallback: plain text input
  return (
    <FormField label={name} required={required}>
      <Input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={name}
      />
    </FormField>
  )
}
