const DB_NAME = 'webrtc-file-storage'
const FILE_STORE = 'files'
const CHUNK_STORE = 'chunks'

export type FileMetadata = {
  id: string
  sid: string
  name: string
  size: number
  type: string
  lastModified: number
  totalChunks: number
  chunkSize: number
  receivedChunks: number
  status: 'pending' | 'transferring' | 'completed' | 'error'
  transferType: 'sending' | 'receiving'
}

export type FileChunk = {
  fileId: string
  index: number
  chunk: ArrayBuffer | string
  progress: number
}

export class FileStorage {
  private db: IDBDatabase | null = null

  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onerror = () => {
        reject(request.error)
      }
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(FILE_STORE)) {
          db.createObjectStore(FILE_STORE, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(CHUNK_STORE)) {
          db.createObjectStore(CHUNK_STORE, { keyPath: ['fileId', 'index'] })
        }
      }
    })
  }

  async saveFileMetadata(metadata: FileMetadata) {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(FILE_STORE, 'readwrite')
      const store = transaction.objectStore(FILE_STORE)
      const request = store.put(metadata)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async saveFileChunk(fileId: string, index: number, chunk: ArrayBuffer) {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(CHUNK_STORE, 'readwrite')
      const request = transaction
        .objectStore(CHUNK_STORE)
        .put({ fileId, index: index, chunk })

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getFileMetadata(fileId: string) {
    if (!this.db) await this.init()
    return new Promise<FileMetadata>((resolve, reject) => {
      const transaction = this.db!.transaction(FILE_STORE, 'readonly')
      const store = transaction.objectStore(FILE_STORE)
      const request = store.get(fileId)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getFileChunks(fileId: string): Promise<FileChunk[]> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(CHUNK_STORE, 'readonly')
      const store = transaction.objectStore(CHUNK_STORE)
      const request = store.getAll(
        IDBKeyRange.bound([fileId, 0], [fileId, Infinity])
      )
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getCompletedFile(fileId: string) {
    if (this.db) await this.init()
    const metadata = await this.getFileMetadata(fileId)
    const chunks = await this.getFileChunks(fileId)
    if (chunks.length !== metadata.totalChunks) return null
    const sortedChunks = chunks.sort((a, b) => a.index - b.index)
    const blob = new Blob(
      sortedChunks.map(({ chunk }) => chunk),
      { type: metadata.type }
    )
    return blob
  }

  async deleteFileMetadata(fileId: string) {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(FILE_STORE, 'readwrite')
      const store = transaction.objectStore(FILE_STORE)
      const request = store.delete(fileId)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async deleteFileChunks(fileId: string) {
    if (!this.db!) await this.init()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(CHUNK_STORE, 'readwrite')
      const request = transaction
        .objectStore(CHUNK_STORE)
        .delete(IDBKeyRange.bound([fileId, 0], [fileId, Infinity]))

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getAllFileMetadata() {
    if (!this.db) await this.init()
    return new Promise<FileMetadata[]>((resolve, reject) => {
      const transaction = this.db!.transaction(FILE_STORE, 'readonly')
      const store = transaction.objectStore(FILE_STORE)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getChunksCount(fileId: string) {
    if (!this.db) await this.init()
    return new Promise<number>((resolve, reject) => {
      const transaction = this.db!.transaction(CHUNK_STORE, 'readonly')
      const store = transaction.objectStore(CHUNK_STORE)
      const request = store.count(
        IDBKeyRange.bound([fileId, 0], [fileId, Infinity])
      )

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async close() {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}
