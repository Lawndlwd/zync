import { Router } from 'express'
import multer from 'multer'
import { errorResponse } from '../lib/errors.js'
import {
  deleteBlob,
  getAllBlobIds,
  getBlob,
  getDocumentCount,
  getDocumentsMetadata,
  getRootDocId,
  getSnapshot,
  insertBlob,
  insertDoc,
  insertRoot,
  insertSnapshot,
} from '../planner/documents.js'

export const blocksuiteDocsRouter = Router()

const upload = multer({ storage: multer.memoryStorage() })

// --- Root document ---
blocksuiteDocsRouter.post('/root', (req, res) => {
  try {
    const { doc_id } = req.body
    if (!doc_id) {
      res.status(400).json({ error: 'doc_id required' })
      return
    }
    const result = insertRoot(doc_id)
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

blocksuiteDocsRouter.get('/root', (_req, res) => {
  try {
    const rootDocId = getRootDocId()
    res.json({ root_doc_id: rootDocId })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Child documents ---
blocksuiteDocsRouter.post('/', (req, res) => {
  try {
    const { doc_id, root_doc_id } = req.body
    if (!doc_id || !root_doc_id) {
      res.status(400).json({ error: 'doc_id and root_doc_id required' })
      return
    }
    insertDoc(doc_id, root_doc_id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Snapshots ---
blocksuiteDocsRouter.post('/snapshot', (req, res) => {
  try {
    const { doc_id, document_state } = req.body
    if (!doc_id || !document_state) {
      res.status(400).json({ error: 'doc_id and document_state required' })
      return
    }
    const buf = Buffer.from(document_state)
    insertSnapshot(doc_id, buf)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

blocksuiteDocsRouter.get('/snapshot/:docId', (req, res) => {
  try {
    const snapshot = getSnapshot(req.params.docId)
    if (!snapshot) {
      res.status(404).json({ error: 'Snapshot not found' })
      return
    }
    res.json({ snapshot })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Blobs ---
blocksuiteDocsRouter.post('/blob', upload.single('blob_data'), (req, res) => {
  try {
    const blobId = req.body.blob_id
    if (!blobId) {
      res.status(400).json({ error: 'blob_id required' })
      return
    }

    let blobData: Buffer
    if (req.file) {
      blobData = req.file.buffer
    } else if (req.body.blob_data && typeof req.body.blob_data === 'string') {
      blobData = Buffer.from(req.body.blob_data, 'base64')
    } else {
      res.status(400).json({ error: 'blob_data required' })
      return
    }

    insertBlob(blobId, blobData)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

blocksuiteDocsRouter.get('/blob/list', (_req, res) => {
  try {
    res.json({ blob_ids: getAllBlobIds() })
  } catch (err) {
    errorResponse(res, err)
  }
})

blocksuiteDocsRouter.get('/blob/:blobId', (req, res) => {
  try {
    const blob = getBlob(req.params.blobId)
    if (!blob) {
      res.status(404).json({ error: 'Blob not found' })
      return
    }
    res.set('Content-Type', 'application/octet-stream')
    res.send(blob)
  } catch (err) {
    errorResponse(res, err)
  }
})

blocksuiteDocsRouter.delete('/blob/:blobId', (req, res) => {
  try {
    deleteBlob(req.params.blobId)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Metadata & count ---
blocksuiteDocsRouter.get('/metadata', (_req, res) => {
  try {
    res.json({ docs: getDocumentsMetadata() })
  } catch (err) {
    errorResponse(res, err)
  }
})

blocksuiteDocsRouter.get('/count', (_req, res) => {
  try {
    res.json({ count: getDocumentCount() })
  } catch (err) {
    errorResponse(res, err)
  }
})
