import { AffineSchemas } from '@blocksuite/blocks'
import { DocCollection, Schema, Text, type Y } from '@blocksuite/store'
import type { BlobSource } from '@blocksuite/sync'
import { client } from './db'

const ROOT_ID = 'root-planner'

export class CollectionProvider {
  collection!: DocCollection
  private static instance: CollectionProvider | null = null
  private static initPromise: Promise<CollectionProvider> | null = null
  private saveListeners: Array<() => void> = []

  static async init(): Promise<CollectionProvider> {
    if (CollectionProvider.instance) {
      return CollectionProvider.instance
    }

    if (CollectionProvider.initPromise) {
      return CollectionProvider.initPromise
    }

    CollectionProvider.initPromise = CollectionProvider._init()
    try {
      CollectionProvider.instance = await CollectionProvider.initPromise
      return CollectionProvider.instance
    } finally {
      CollectionProvider.initPromise = null
    }
  }

  private static async _init(): Promise<CollectionProvider> {
    const hasData = await client.checkForExistingData()
    if (hasData) {
      return CollectionProvider._loadFromDb()
    }
    return CollectionProvider._initEmpty()
  }

  static reset(): void {
    CollectionProvider.instance = null
    CollectionProvider.initPromise = null
  }

  onSave(listener: () => void): () => void {
    this.saveListeners.push(listener)
    return () => {
      this.saveListeners = this.saveListeners.filter((l) => l !== listener)
    }
  }

  private notifySave(): void {
    for (const l of this.saveListeners) l()
  }

  async saveNow(): Promise<void> {
    if (!this.collection) return
    const documentState = DocCollection.Y.encodeStateAsUpdate(this.collection.doc)
    await client.insertSnapshot(this.collection.id, documentState)
    this.notifySave()
  }

  /** Ensure a specific page document exists and is loaded */
  async ensurePageDoc(pageId: string, title?: string): Promise<ReturnType<DocCollection['getDoc']>> {
    let doc = this.collection.getDoc(pageId)

    if (!doc) {
      doc = this.collection.createDoc({ id: pageId })
      if (doc) {
        doc.load(() => {
          if (doc) {
            const pageBlockId = doc.addBlock('affine:page', {
              title: new Text(title || ''),
            })
            doc.addBlock('affine:surface', {}, pageBlockId)
            const noteId = doc.addBlock('affine:note', {}, pageBlockId)
            doc.addBlock('affine:paragraph', {}, noteId)
          }
        })
        doc.resetHistory()
        this._connectSubDoc(doc.spaceDoc)
      }
    } else {
      if (!doc.loaded) {
        await this._applySnapshot(doc.spaceDoc)
        doc.load()
        this._connectSubDoc(doc.spaceDoc)
      }
      // Sync title if provided and current title is empty
      if (title && doc.meta?.title !== title) {
        const pageBlock = doc.root
        if (pageBlock && pageBlock.flavour === 'affine:page') {
          const currentTitle = (pageBlock as any).title?.toString?.() || ''
          if (!currentTitle) {
            ;(pageBlock as any).title = new Text(title)
          }
        }
      }
    }

    return doc
  }

  private static async _initEmpty(): Promise<CollectionProvider> {
    const provider = new CollectionProvider()
    const result = await client.insertRoot(ROOT_ID)
    const actualRootId = result.docId || ROOT_ID

    provider.collection = createCollection(actualRootId)
    provider._connectCollection()
    provider.collection.meta.initialize()

    return provider
  }

  private static async _loadFromDb(): Promise<CollectionProvider> {
    const provider = new CollectionProvider()
    const id = await client.getRootDocId()
    if (!id) {
      return CollectionProvider._initEmpty()
    }

    provider.collection = createCollection(id)
    await provider._applySnapshot(provider.collection.doc)

    const docsMetadata = await client.getDocumentsMetadata()
    for (const meta of docsMetadata) {
      if (meta.docId !== id) {
        const doc = provider.collection.getDoc(meta.docId)
        if (doc) {
          if (meta.hasSnapshot) {
            await provider._applySnapshot(doc.spaceDoc)
          }
          doc.load()
          provider._connectSubDoc(doc.spaceDoc)
        }
      }
    }

    provider._connectCollection()
    return provider
  }

  private _connectCollection(): void {
    const { collection } = this
    let saveTimeout: ReturnType<typeof setTimeout> | null = null

    const saveSnapshot = async () => {
      if (saveTimeout) clearTimeout(saveTimeout)
      const documentState = DocCollection.Y.encodeStateAsUpdate(collection.doc)
      await client.insertSnapshot(collection.id, documentState)
      this.notifySave()
    }

    collection.doc.on('update', () => {
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(saveSnapshot, 2000)
    })

    window.addEventListener('beforeunload', saveSnapshot)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveSnapshot()
    })

    collection.doc.on('subdocs', (subdocs: { added: Set<Y.Doc> }) => {
      for (const doc of subdocs.added) {
        client.insertDoc(doc.guid, collection.id)
        this._connectSubDoc(doc)
      }
    })
  }

  private _connectSubDoc(doc: Y.Doc): void {
    let saveTimeout: ReturnType<typeof setTimeout> | null = null

    const saveSnapshot = async () => {
      if (saveTimeout) clearTimeout(saveTimeout)
      const documentState = DocCollection.Y.encodeStateAsUpdate(doc)
      await client.insertSnapshot(doc.guid, documentState)
      this.notifySave()
    }

    doc.on('update', () => {
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(saveSnapshot, 2000)
    })

    window.addEventListener('beforeunload', saveSnapshot)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveSnapshot()
    })
  }

  private async _applySnapshot(doc: Y.Doc): Promise<void> {
    const snapshot = await client.getSnapshot(doc.guid)
    if (snapshot) {
      DocCollection.Y.applyUpdate(doc, snapshot)
    }
  }
}

function createCollection(id: string): DocCollection {
  const schema = new Schema().register(AffineSchemas)
  const collection = new DocCollection({
    schema,
    id,
    blobSources: {
      main: new ClientBlobSource(),
    },
  })
  return collection
}

class ClientBlobSource implements BlobSource {
  readonly = false
  name = 'client'

  async get(key: string): Promise<Blob | null> {
    return client.getBlob(key)
  }

  async set(key: string, value: Blob): Promise<string> {
    await client.insertBlob(key, value)
    return key
  }

  async delete(key: string): Promise<void> {
    return client.deleteBlob(key)
  }

  async list(): Promise<string[]> {
    return client.getAllBlobIds()
  }
}
