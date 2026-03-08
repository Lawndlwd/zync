import { z } from 'zod'
import { getDriveClient } from './google-auth.js'

// --- drive_list_files ---

export const driveListFilesSchema = z.object({
  folder_id: z.string().optional().describe('Folder ID to list files from (default: root)'),
  max_results: z.number().default(25).describe('Maximum number of files (default 25)'),
  order_by: z.string().default('modifiedTime desc').describe('Sort order (default "modifiedTime desc")'),
})

export async function driveListFiles(input: z.infer<typeof driveListFilesSchema>): Promise<string> {
  const drive = getDriveClient()

  let q = 'trashed = false'
  if (input.folder_id) {
    q += ` and '${input.folder_id}' in parents`
  }

  const res = await drive.files.list({
    q,
    pageSize: input.max_results,
    orderBy: input.order_by,
    fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, parents)',
  })

  const files = (res.data.files || []).map(f => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ? Number(f.size) : undefined,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink || '',
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
  }))

  return JSON.stringify({ count: files.length, files })
}

// --- drive_search_files ---

export const driveSearchFilesSchema = z.object({
  query: z.string().describe('Search query (searches file names and content)'),
  max_results: z.number().default(20).describe('Maximum number of results (default 20)'),
})

export async function driveSearchFiles(input: z.infer<typeof driveSearchFilesSchema>): Promise<string> {
  const drive = getDriveClient()

  const res = await drive.files.list({
    q: `fullText contains '${input.query.replace(/'/g, "\\'")}' and trashed = false`,
    pageSize: input.max_results,
    fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
    orderBy: 'relevance',
  })

  const files = (res.data.files || []).map(f => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ? Number(f.size) : undefined,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink || '',
  }))

  return JSON.stringify({ count: files.length, files })
}

// --- drive_get_file_content ---

export const driveGetFileContentSchema = z.object({
  file_id: z.string().describe('File ID to read content from'),
})

export async function driveGetFileContent(input: z.infer<typeof driveGetFileContentSchema>): Promise<string> {
  const drive = getDriveClient()

  // Get file metadata first
  const meta = await drive.files.get({
    fileId: input.file_id,
    fields: 'id, name, mimeType, size',
  })

  const mimeType = meta.data.mimeType || ''
  let content: string

  // Google Workspace docs need export
  if (mimeType === 'application/vnd.google-apps.document') {
    const res = await drive.files.export({ fileId: input.file_id, mimeType: 'text/plain' })
    content = String(res.data)
  } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const res = await drive.files.export({ fileId: input.file_id, mimeType: 'text/csv' })
    content = String(res.data)
  } else if (mimeType === 'application/vnd.google-apps.presentation') {
    const res = await drive.files.export({ fileId: input.file_id, mimeType: 'text/plain' })
    content = String(res.data)
  } else {
    // Regular file — download as text
    const res = await drive.files.get(
      { fileId: input.file_id, alt: 'media' },
      { responseType: 'text' }
    )
    content = String(res.data)
  }

  // Truncate very large files
  const maxLen = 50_000
  const truncated = content.length > maxLen
  if (truncated) content = content.slice(0, maxLen)

  return JSON.stringify({
    id: meta.data.id,
    name: meta.data.name,
    mimeType,
    content,
    truncated,
  })
}

// --- drive_upload_file ---

export const driveUploadFileSchema = z.object({
  name: z.string().describe('File name'),
  content: z.string().describe('Text content of the file'),
  mime_type: z.string().default('text/plain').describe('MIME type (default "text/plain")'),
  folder_id: z.string().optional().describe('Parent folder ID'),
})

export async function driveUploadFile(input: z.infer<typeof driveUploadFileSchema>): Promise<string> {
  const drive = getDriveClient()
  const { Readable } = await import('stream')

  const fileMetadata: any = { name: input.name }
  if (input.folder_id) fileMetadata.parents = [input.folder_id]

  const media = {
    mimeType: input.mime_type,
    body: Readable.from([input.content]),
  }

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, name, webViewLink',
  })

  return JSON.stringify({
    success: true,
    id: res.data.id,
    name: res.data.name,
    webViewLink: res.data.webViewLink || '',
  })
}
