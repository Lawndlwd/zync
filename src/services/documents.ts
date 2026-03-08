import type { DocFolder, Document } from '@/types/document'

const API = '/api/documents'

// ── Folders ──

export async function fetchFolders(parent?: string): Promise<DocFolder[]> {
  const url = parent ? `${API}/folders?parent=${encodeURIComponent(parent)}` : `${API}/folders`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch folders')
  return res.json()
}

export async function createFolder(name: string): Promise<DocFolder> {
  const res = await fetch(`${API}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Failed to create folder')
  return res.json()
}

export async function renameFolder(oldName: string, newName: string): Promise<DocFolder> {
  const res = await fetch(`${API}/folders/${encodeURIComponent(oldName)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  })
  if (!res.ok) throw new Error('Failed to rename folder')
  return res.json()
}

export async function deleteFolder(name: string): Promise<void> {
  const res = await fetch(`${API}/folders/${encodeURIComponent(name)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete folder')
}

// ── Documents ──

export async function fetchDocuments(folder?: string): Promise<Document[]> {
  const url = folder ? `${API}?folder=${encodeURIComponent(folder)}` : API
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch documents')
  return res.json()
}

export async function createDocument(input: {
  folder: string
  title: string
  content?: string
}): Promise<Document> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to create document')
  return res.json()
}

export async function updateDocument(
  path: string,
  updates: Partial<{ title: string; content: string; folder: string }>
): Promise<Document> {
  const res = await fetch(`${API}/file/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update document')
  return res.json()
}

export async function deleteDocument(path: string): Promise<void> {
  const res = await fetch(`${API}/file/${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete document')
}

export async function fetchDocumentsBulk(paths: string[]): Promise<{ path: string; title: string; content: string }[]> {
  const res = await fetch(`${API}/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths }),
  })
  if (!res.ok) throw new Error('Failed to fetch documents in bulk')
  return res.json()
}
