import { useEffect, useState } from 'react'
import { useIOClient } from './use-io-client'
import { useIOSubscribe } from './use-io-subscribe'
import { useSocketIO } from './use-socket'
import RTCManager from '@/lib/rtc-manager'
import { receiveFile, sendFile } from '@/lib/file-transfer'
import { FileMetadata, FileStorage } from '@/storage/indexed-db'

type FileState = FileMetadata & {
  progress: number
}
const useRTC = (
  roomId: string,
  fileStorage: FileStorage,
  cbs?: { onUpdateStoredFiles?: () => void }
) => {
  const { ioEventsManager } = useSocketIO()
  const { roomClients, setRoomClients, id } = useIOClient()
  const [peers, setPeers] = useState<RTCManager[]>([])
  const [connectionState, setConnectionState] = useState<{
    [sid: string]: string
  }>({})
  const [transferFiles, setTransferFiles] = useState<{
    [fileId: string]: FileState
  }>({})

  useIOSubscribe<{ clients: string[] }>('room_clients', ({ clients }) => {
    setRoomClients(clients)
  })

  useIOSubscribe<{
    offer: RTCSessionDescriptionInit
    to: string
    from: string
  }>('offer', async ({ offer, to, from }) => {
    const peer = peers.find((p) => p.sid === from)
    if (!peer) {
      throw Error("Peer doesn't exist")
    }
    await peer.acceptOffer(offer)
    const answer = await peer.createAnswer()
    ioEventsManager.publish('answer', {
      answer,
      room: roomId,
      to: from,
      from: to,
    })
  })

  useIOSubscribe<{
    answer: RTCSessionDescriptionInit
    to: string
    from: string
  }>('answer', async ({ answer, from }) => {
    const peer = peers.find((p) => p.sid === from)
    if (!peer) {
      throw Error("Peer doesn't exist")
    }
    await peer.acceptAnswer(answer)
  })

  useIOSubscribe<{ candidate: RTCIceCandidateInit; to: string; from: string }>(
    'ice_candidate',
    async ({ candidate, from }) => {
      console.log('ice candidate received')
      const peer = peers.find((p) => p.sid === from)
      if (!peer) {
        throw Error("Peer doesn't exist")
      }
      await peer.addIceCandidate(candidate)
    }
  )

  useEffect(() => {
    if (!id || !roomId) return
    setPeers((p) => {
      const oldPeers = p.filter((p) => roomClients.includes(p.sid))
      return [
        ...oldPeers,
        ...roomClients
          .filter((sid) => id !== sid && !oldPeers.find((p) => p.sid === sid))
          .map((sid) => new RTCManager(sid)),
      ]
    })
  }, [id, roomId, roomClients])

  useEffect(() => {
    peers.forEach((peer) => {
      peer.peer.onicecandidate = ({ candidate }) => {
        console.log('ice candidate found')
        ioEventsManager.publish('ice_candidate', {
          candidate,
          room: roomId,
          to: peer.sid,
          from: id,
        })
      }
      peer.peer.onconnectionstatechange = ({ currentTarget }) => {
        setConnectionState((p) => ({
          ...p,
          [peer.sid]: (currentTarget as RTCPeerConnection).connectionState,
        }))
        if (
          (currentTarget as RTCPeerConnection).connectionState === 'connected'
        ) {
          peer.closeDataChannel('file-transfer')
        }
      }
      peer.peer.ondatachannel = (e) => {
        const channel = peer.onDataChannel(e)
        receiveFile(peer.sid, channel, fileStorage, (fs) => {
          setTransferFiles((p) => ({
            ...p,
            [fs.id]: fs,
          }))
          if (fs.status === 'completed') {
            cbs?.onUpdateStoredFiles?.()
          }
        })
      }
    })
    return () => {
      peers.forEach(({ peer }) => {
        peer.onicecandidate = null
        peer.onconnectionstatechange = null
        peer.ondatachannel = null
        // peer.close()
      })
    }
  }, [fileStorage, id, ioEventsManager, peers, cbs, roomId])

  const sendFileToConnectedPeers = (
    files: File[],
    fileStorage: FileStorage
  ) => {
    if (!files.length) return
    peers.forEach((peer) => {
      if (peer.peer.connectionState !== 'connected') return
      for (const file of files) {
        sendFile(peer, file, fileStorage, (fs) => {
          setTransferFiles((p) => ({
            ...p,
            [fs.id]: fs,
          }))
          if (fs.status === 'completed') {
            cbs?.onUpdateStoredFiles?.()
          }
        })
      }
    })
  }

  const createOffer = async (sid: string) => {
    const peer = peers.find((p) => p.sid === sid)
    if (!peer) {
      return
    }
    peer.createDataChannel('file-transfer')
    const offer = await peer.createOffer()
    ioEventsManager.publish('offer', {
      offer,
      room: roomId,
      to: sid,
      from: id,
    })
  }

  const closePeer = async (sid: string) => {
    const peer = peers.find((peer) => peer.sid === sid)!
    peer.close()
    setConnectionState((p) => ({ ...p, [sid]: 'closed' }))
    setPeers((p) => [...p.filter((p) => p.sid !== sid), new RTCManager(sid)])
  }

  return {
    peers,
    setPeers,
    connectionState,
    createOffer,
    sendFileToConnectedPeers,
    transferFiles,
    setTransferFiles,
    closePeer,
  }
}

export default useRTC
