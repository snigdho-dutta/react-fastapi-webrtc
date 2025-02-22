import { FileStorage } from '@/storage/indexed-db'

interface ReceiveFileEvent extends MessageEvent {
  fileId: string
}

self.onmessage = async (e) => {
  console.log('Download Worker Initialized', e)
  const { fileId } = e.data as ReceiveFileEvent
  const fileStorage = new FileStorage()
  const metadata = await fileStorage.getFileMetadata(fileId)
  if (!metadata) {
    throw new Error('File metadata not found')
  }
  const blob = await fileStorage.getCompletedFile(fileId)
  if (!blob) {
    throw new Error('File not found or incomplete')
  }

  self.postMessage({
    blob,
    metadata,
  })
}
