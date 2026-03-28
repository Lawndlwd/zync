const API_BASE = '/api/planner/document'

class StorageClient {
  async insertRoot(rootId: string): Promise<{ docId: string }> {
    const res = await fetch(`${API_BASE}/root`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_id: rootId }),
    })
    return res.json()
  }

  async getRootDocId(): Promise<string | null> {
    const res = await fetch(`${API_BASE}/root`)
    const data = await res.json()
    return data.root_doc_id ?? null
  }

  async insertDoc(docId: string, rootDocId: string): Promise<void> {
    await fetch(`${API_BASE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_id: docId, root_doc_id: rootDocId }),
    })
  }

  async insertSnapshot(docId: string, documentState: Uint8Array): Promise<void> {
    await fetch(`${API_BASE}/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_id: docId,
        document_state: Array.from(documentState),
      }),
    })
  }

  async getSnapshot(docId: string): Promise<Uint8Array | null> {
    try {
      const res = await fetch(`${API_BASE}/snapshot/${encodeURIComponent(docId)}`)
      if (!res.ok) return null
      const data = await res.json()
      return new Uint8Array(data.snapshot.document_state)
    } catch {
      return null
    }
  }

  async insertBlob(blobId: string, blobData: Blob): Promise<void> {
    const formData = new FormData()
    formData.append('blob_id', blobId)
    formData.append('blob_data', blobData)
    await fetch(`${API_BASE}/blob`, { method: 'POST', body: formData })
  }

  async getBlob(blobId: string): Promise<Blob | null> {
    try {
      const res = await fetch(`${API_BASE}/blob/${encodeURIComponent(blobId)}`)
      if (!res.ok) return null
      return res.blob()
    } catch {
      return null
    }
  }

  async deleteBlob(blobId: string): Promise<void> {
    await fetch(`${API_BASE}/blob/${encodeURIComponent(blobId)}`, { method: 'DELETE' })
  }

  async getAllBlobIds(): Promise<string[]> {
    try {
      const res = await fetch(`${API_BASE}/blob/list`)
      const data = await res.json()
      return data.blob_ids ?? []
    } catch {
      return []
    }
  }

  async getDocumentsMetadata(): Promise<
    Array<{
      docId: string
      rootDocId: string | null
      hasSnapshot: boolean
    }>
  > {
    try {
      const res = await fetch(`${API_BASE}/metadata`)
      const data = await res.json()
      return data.docs ?? []
    } catch {
      return []
    }
  }

  async checkForExistingData(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/count`)
      const data = await res.json()
      return data.count > 0
    } catch {
      return false
    }
  }
}

export const client = new StorageClient()
