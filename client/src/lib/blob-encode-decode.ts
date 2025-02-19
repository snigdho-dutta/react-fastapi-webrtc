export async function decodeBlobToObject(blob: Blob) {
  // Read the Blob as an ArrayBuffer
  const arrayBuffer = await blob.arrayBuffer()

  // Extract the JSON string (first part of the Blob)
  const decoder = new TextDecoder('utf-8')
  const jsonString = decoder.decode(arrayBuffer.slice(0, blob.size))

  // Parse the JSON string to get the non-ArrayBuffer fields
  const obj = JSON.parse(jsonString)

  // Extract the ArrayBuffer fields (remaining parts of the Blob)
  let offset = jsonString.length
  for (const key in obj) {
    if (obj[key] instanceof ArrayBuffer) {
      const arrayBufferSize = obj[key].byteLength
      obj[key] = arrayBuffer.slice(offset, offset + arrayBufferSize)
      offset += arrayBufferSize
    }
  }

  return obj
}

export function encodeObjectToBlob(obj: {
  [key: string]: ArrayBuffer | string | number | boolean
}) {
  // Convert the object into a JSON string (excluding ArrayBuffer fields)
  const jsonPart: { [key: string]: string | number | boolean } = {}
  const arrayBufferFields: { [key: string]: ArrayBuffer } = {}

  for (const key in obj) {
    if (obj[key] instanceof ArrayBuffer) {
      arrayBufferFields[key] = obj[key]
    } else {
      jsonPart[key] = obj[key]
    }
  }

  const jsonString = JSON.stringify(jsonPart)

  // Create a Blob with the JSON string and ArrayBuffer fields
  const blobParts: BlobPart[] = [jsonString]
  for (const key in arrayBufferFields) {
    blobParts.push(arrayBufferFields[key])
  }

  return new Blob(blobParts, { type: 'application/octet-stream' })
}

export function arrayBufferToBase64(arrayBuffer: ArrayBuffer) {
  // Create a Uint8Array view of the ArrayBuffer
  const uint8Array = new Uint8Array(arrayBuffer)

  // Convert the Uint8Array to a binary string
  let binaryString = ''
  uint8Array.forEach((byte) => {
    binaryString += String.fromCharCode(byte)
  })

  // Encode the binary string to Base64
  return btoa(binaryString)
}

export function base64ToArrayBuffer(base64: string) {
  // Decode the Base64 string to a binary string
  const binaryString = atob(base64)

  // Create a Uint8Array from the binary string
  const uint8Array = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i)
  }

  // Return the ArrayBuffer
  return uint8Array.buffer
}
