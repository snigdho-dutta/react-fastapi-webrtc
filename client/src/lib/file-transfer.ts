import { FileChunk, FileMetadata, FileStorage } from '@/storage/indexed-db'
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  decodeBlobToObject,
} from './blob-encode-decode'
import RTCManager from './rtc-manager'

export type ChannelData = {
  type: string
  metadata?: FileMetadata
  chunk?: ArrayBuffer
  fileId?: string
  index?: number
  progress?: number
}

const CHUNK_SIZE = 256 * 1024 // 256KB
const MAX_BUFFER_THRESHOLD = 64 * 1024 // 64KB

export const sendFileAsBase64 = async (
  dataChannel: RTCDataChannel,
  file: File,
  onProgress?: (progress: number) => void
) => {
  if (dataChannel?.readyState === 'open') {
    const fileId = crypto.randomUUID()
    const metadata: FileMetadata = {
      id: fileId,
      sid: '',
      name: file.name,
      size: file.size,
      type: file.type,
      chunkSize: CHUNK_SIZE,
      totalChunks: Math.ceil(file.size / CHUNK_SIZE),
      receivedChunks: 0,
      status: 'pending',
      transferType: 'sending',
      lastModified: file.lastModified,
    }

    dataChannel.send(JSON.stringify({ type: 'metadata', metadata }))

    const chunkBytesIndexes = Array.from(
      {
        length: Math.ceil(file.size / CHUNK_SIZE),
      },
      (_, i) => i * CHUNK_SIZE
    )

    const reader = new FileReader()
    for (let i = 0; i < chunkBytesIndexes.length; i++) {
      const chunkBytesIdx = chunkBytesIndexes[i]
      const chunkBlob = file.slice(chunkBytesIdx, chunkBytesIdx + CHUNK_SIZE)
      const chunk = await readChunk(reader, chunkBlob)
      while (dataChannel.bufferedAmount > MAX_BUFFER_THRESHOLD) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      const progress = ((i + 1) / chunkBytesIndexes.length) * 100
      dataChannel.send(
        JSON.stringify({
          type: 'chunk',
          fileId,
          index: i,
          chunk: arrayBufferToBase64(chunk),
          progress,
        })
      )
      onProgress?.(progress)
    }
    while (dataChannel.bufferedAmount > 0) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    dataChannel.send(JSON.stringify({ type: 'complete', fileId }))
  }
}

const readChunk = (reader: FileReader, chunk: Blob) => {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(chunk)
  })
}

export const receiveFileAsBase64 = async (
  dataChannel: RTCDataChannel,
  fileStorage: FileStorage,
  cb?: (progress: number) => void
) => {
  if (!dataChannel) throw new Error('Data channel not found')
  dataChannel.onmessage = async ({ data }) => {
    data = (
      typeof data === 'string'
        ? JSON.parse(data)
        : await decodeBlobToObject(data)
    ) as ChannelData
    switch (data.type) {
      case 'metadata': {
        const metadata = (await data.metadata) as FileMetadata
        metadata.status = 'transferring'
        metadata.transferType = 'receiving'
        await fileStorage.saveFileMetadata(metadata)
        break
      }
      case 'chunk': {
        const { chunk, fileId, index, progress } = data as FileChunk
        await fileStorage.saveFileChunk(
          fileId,
          index,
          base64ToArrayBuffer(chunk as string)
        )
        cb?.(progress)
        break
      }
      case 'complete': {
        const metadata = await fileStorage.getFileMetadata(data.fileId!)
        metadata.status = 'completed'
        downloadFile(metadata.id, fileStorage)
        break
      }
    }
  }
}

export const sendFile = async (
  peer: RTCManager,
  file: File,
  fileStorage: FileStorage,
  onProgress?: (v: FileMetadata & { progress: number }) => void
) => {
  const fileId = crypto.randomUUID()
  const dataChannel = peer.createDataChannel(fileId)
  dataChannel.onopen = async () => {
    const metadata: FileMetadata = {
      id: fileId,
      sid: peer.sid,
      name: file.name,
      size: file.size,
      type: file.type,
      chunkSize: CHUNK_SIZE,
      totalChunks: Math.ceil(file.size / CHUNK_SIZE),
      receivedChunks: 0,
      status: 'pending',
      transferType: 'sending',
      lastModified: file.lastModified,
    }
    await fileStorage.saveFileMetadata(metadata)
    dataChannel.send(JSON.stringify({ type: 'metadata', metadata }))

    const chunkBytesIndexes = Array.from(
      {
        length: Math.ceil(file.size / CHUNK_SIZE),
      },
      (_, i) => i * CHUNK_SIZE
    )

    const reader = new FileReader()
    for (let i = 0; i < chunkBytesIndexes.length; i++) {
      const chunkBytesIdx = chunkBytesIndexes[i]
      const chunkBlob = file.slice(chunkBytesIdx, chunkBytesIdx + CHUNK_SIZE)
      const progress = +(((i + 1) / chunkBytesIndexes.length) * 100).toFixed(2)
      const chunkMetadata: Omit<FileChunk, 'chunk'> = {
        fileId,
        index: i,
        progress,
      }

      dataChannel.send(
        JSON.stringify({ type: 'chunk-metadata', metadata: chunkMetadata })
      )
      onProgress?.({ ...metadata, progress })
      const chunk = await readChunk(reader, chunkBlob)
      while (dataChannel.bufferedAmount > MAX_BUFFER_THRESHOLD) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      dataChannel.send(chunk)
    }
    while (dataChannel.bufferedAmount > 0) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    metadata.status = 'completed'
    await fileStorage.saveFileMetadata(metadata)
    dataChannel.send(JSON.stringify({ type: 'complete', metadata }))
    onProgress?.({ ...metadata, progress: 100 })
  }
}

export const receiveFile = async (
  sid: string,
  dataChannel: RTCDataChannel,
  fileStorage: FileStorage,
  onProgress?: (v: FileMetadata & { progress: number }) => void
) => {
  if (!dataChannel) throw new Error('Data channel not found')
  let fileMetadata: FileMetadata
  let chunkMetadata: Omit<FileChunk, 'chunk'>
  dataChannel.onmessage = async ({ data }) => {
    if (typeof data === 'string') {
      data = JSON.parse(data) as ChannelData
      switch (data.type) {
        case 'metadata': {
          fileMetadata = data.metadata! as FileMetadata
          fileMetadata.status = 'transferring'
          fileMetadata.sid = sid
          fileMetadata.transferType = 'receiving'
          await fileStorage.saveFileMetadata(data.metadata!)
          break
        }
        case 'chunk-metadata': {
          chunkMetadata = data.metadata! as FileChunk
          onProgress?.({ ...fileMetadata, progress: chunkMetadata.progress })
          break
        }
        case 'complete': {
          const metadata = data.metadata! as FileMetadata
          metadata.sid = sid
          metadata.transferType = 'receiving'
          await fileStorage.saveFileMetadata(metadata)
          onProgress?.({ ...metadata, progress: 100 })
          dataChannel.close()
          // await downloadFile(metadata.id, fileStorage)
          // await deleteFile(data.fileId, fileStorage)
          break
        }
      }
    } else {
      await fileStorage.saveFileChunk(
        chunkMetadata.fileId!,
        chunkMetadata.index!,
        data
      )
    }
  }
}

export const downloadFile = async (
  fileId: string,
  fileStorage: FileStorage
) => {
  const blob = await fileStorage.getCompletedFile(fileId)
  if (!blob) throw new Error('File not found or incomplete')

  const metadata = await fileStorage.getFileMetadata(fileId)
  if (!metadata) throw new Error('File metadata not found')

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = metadata.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const deleteFile = async (fileId: string, fileStorage: FileStorage) => {
  await fileStorage.deleteFileMetadata(fileId)
  await fileStorage.deleteFileChunks(fileId)
}

export const getStoredFiles = async (fileStorage: FileStorage) => {
  const files = await fileStorage.getAllFileMetadata()
  for (const file of files) {
    if (file.status === 'completed') {
      const chunksCount = await fileStorage.getChunksCount(file.id)
      if (chunksCount > 0 && file.totalChunks !== chunksCount) {
        file.status = 'error'
        await fileStorage.saveFileMetadata(file)
      }
    }
  }
  return files
}

export const deleteAllStoredFiles = async (fileStorage: FileStorage) => {
  const files = await fileStorage.getAllFileMetadata()
  for (const file of files) {
    await deleteFile(file.id, fileStorage)
  }
}
