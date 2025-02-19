// import { FileChunk } from '@/storage/indexed-db'

// const ctx: Worker = self as any

// ctx.onmessage = async (event: MessageEvent) => {
//   const { file, chunkSize } = event.data
//   const fileReader = new FileReader()
//   const chunks: FileChunk[] = []
//   let offset = 0
//   const fileId = crypto.randomUUID()

//   const readNextCHunk = async () => {
//     const chunk = file.slice(offset, offset + chunkSize)
//     const chunkData = await fileReader.readAsArrayBuffer(chunk)
//   }
// }
