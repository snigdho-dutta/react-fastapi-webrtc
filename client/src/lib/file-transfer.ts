import { FileChunk, FileMetadata, FileStorage } from '@/storage/indexed-db'
import RTCManager from './rtc-manager'
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  decodeBlobToObject,
} from './blob-encode-decode'

export type ChannelData = {
  type: string
  metadata?: FileMetadata
  chunk?: ArrayBuffer
  fileId?: string
  index?: number
  progress?: number
}

const CHUNK_SIZE = 128 * 1024 // 256KB
const MAX_BUFFER_THRESHOLD = 64 * 1024 // 64KB

export const sendFileAsBase64 = async (
  peer: RTCManager,
  file: File,
  onProgress?: (progress: number) => void
) => {
  if (
    peer.peer.connectionState === 'connected' &&
    peer.dataChannel?.readyState === 'open'
  ) {
    const fileId = crypto.randomUUID()
    const metadata: FileMetadata = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      chunkSize: CHUNK_SIZE,
      totalChunks: Math.ceil(file.size / CHUNK_SIZE),
      receivedChunks: 0,
      status: 'pending',
      lastModified: file.lastModified,
    }

    peer.dataChannel.send(JSON.stringify({ type: 'metadata', metadata }))

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
      while (peer.dataChannel.bufferedAmount > MAX_BUFFER_THRESHOLD) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      const progress = ((i + 1) / chunkBytesIndexes.length) * 100
      peer.dataChannel.send(
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
    while (peer.dataChannel.bufferedAmount > 0) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    peer.dataChannel.send(JSON.stringify({ type: 'complete', fileId }))
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
  peer: RTCManager,
  fileStorage: FileStorage,
  cb?: (progress: number) => void
) => {
  if (!peer.dataChannel) throw new Error('Data channel not found')
  peer.dataChannel.onmessage = async (message) => {
    const data = (
      typeof message.data === 'string'
        ? JSON.parse(message.data)
        : await decodeBlobToObject(message.data)
    ) as ChannelData
    switch (data.type) {
      case 'metadata': {
        await fileStorage.saveFileMetadata(data.metadata! as FileMetadata)
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
  await fileStorage.deleteFileMetadata(fileId)
  await fileStorage.deleteFileChunks(fileId)
}

export const sendFile = async (
  peer: RTCManager,
  file: File,
  onProgress?: (progress: number) => void
) => {
  if (
    peer.peer.connectionState === 'connected' &&
    peer.dataChannel?.readyState === 'open'
  ) {
    const fileId = crypto.randomUUID()
    const metadata: FileMetadata = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      chunkSize: CHUNK_SIZE,
      totalChunks: Math.ceil(file.size / CHUNK_SIZE),
      receivedChunks: 0,
      status: 'pending',
      lastModified: file.lastModified,
    }

    peer.dataChannel.send(JSON.stringify({ type: 'metadata', metadata }))

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
      const progress = ((i + 1) / chunkBytesIndexes.length) * 100
      const chunkMetadata: Omit<FileChunk, 'chunk'> = {
        fileId,
        index: i,
        progress,
      }

      peer.dataChannel.send(
        JSON.stringify({ type: 'chunk-metadata', metadata: chunkMetadata })
      )
      onProgress?.(progress)
      const chunk = await readChunk(reader, chunkBlob)
      while (peer.dataChannel.bufferedAmount > MAX_BUFFER_THRESHOLD) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      peer.dataChannel.send(chunk)

      // onProgress?.(progress)
    }
    while (peer.dataChannel.bufferedAmount > 0) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    peer.dataChannel.send(JSON.stringify({ type: 'complete', fileId }))
  }
}

export const receiveFile = async (
  peer: RTCManager,
  fileStorage: FileStorage,
  onProgress?: (progress: number) => void
) => {
  if (!peer.dataChannel) throw new Error('Data channel not found')
  let chunkMetadata: Omit<FileChunk, 'chunk'>
  peer.dataChannel.onmessage = async ({ data }) => {
    // console.log('received', data)
    if (typeof data === 'string') {
      data = JSON.parse(data) as ChannelData
      switch (data.type) {
        case 'metadata': {
          await fileStorage.saveFileMetadata(data.metadata! as FileMetadata)
          break
        }
        case 'chunk-metadata': {
          chunkMetadata = data.metadata! as FileChunk
          onProgress?.(chunkMetadata.progress)
          break
        }
        case 'complete': {
          const metadata = await fileStorage.getFileMetadata(data.fileId!)
          metadata.status = 'completed'
          downloadFile(metadata.id, fileStorage)
          break
        }
      }
    } else {
      console.log('chunkmetadata', chunkMetadata)
      await fileStorage.saveFileChunk(
        chunkMetadata.fileId!,
        chunkMetadata.index!,
        data
      )
    }
  }
}
