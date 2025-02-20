import { useEffect, useState } from 'react'
import { useIOClient } from './use-io-client'
import { useIOSubscribe } from './use-io-subscribe'
import { useSocketIO } from './use-socket'
import RTCManager, { Peer } from '@/lib/rtc-manager'
import { receiveFile } from '@/lib/file-transfer'
import { FileMetadata, FileStorage } from '@/storage/indexed-db'

type FileState = FileMetadata & {
  progress: number
}
const useRTC = (roomId: string, fileStorage: FileStorage) => {
  const { ioEventsManager } = useSocketIO()
  const { roomClients, setRoomClients, id } = useIOClient()
  const [peers, setPeers] = useState<Peer[]>([])
  const [connectionState, setConnectionState] = useState<{
    [sid: string]: string
  }>({})
  const [sendFiles, setSendFiles] = useState<{ [sid: string]: FileState[] }>({})
  const [receiveFiles, setReceiveFiles] = useState<{
    [sid: string]: FileState[]
  }>({})

  useIOSubscribe<{
    offer: RTCSessionDescriptionInit
    to: string
    from: string
  }>('offer', async ({ offer, to, from }) => {
    const peer = peers.find((p) => p.sid === from)
    if (!peer) {
      throw Error("Peer doesn't exist")
    }
    await peer.peer.acceptOffer(offer)
    const answer = await peer.peer.createAnswer()
    ioEventsManager.publish('answer', {
      answer,
      room: roomId,
      to: from,
      from: to,
    })
  })

  useIOSubscribe<{ clients: string[] }>('room_clients', ({ clients }) => {
    setRoomClients(clients)
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
    await peer.peer.acceptAnswer(answer)
  })

  useIOSubscribe<{ candidate: RTCIceCandidateInit; to: string; from: string }>(
    'ice_candidate',
    async ({ candidate, to, from }) => {
      console.log('ice_candidate', { candidate, to, from })
      const peer = peers.find((p) => p.sid === from)
      if (!peer) {
        throw Error("Peer doesn't exist")
      }
      await peer.peer.addIceCandidate(candidate)
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
          .map((sid) => ({
            sid,
            peer: new RTCManager(undefined),
          })),
      ]
    })
  }, [id, roomId, roomClients])

  useEffect(() => {
    peers.forEach(({ peer, sid }) => {
      peer.peer.onicecandidate = ({ candidate }) => {
        console.log('onicecandidate', candidate)
        ioEventsManager.publish('ice_candidate', {
          candidate,
          room: roomId,
          to: sid,
          from: id,
        })
      }
      peer.peer.onconnectionstatechange = ({ currentTarget }) => {
        setConnectionState((p) => ({
          ...p,
          [sid]: (currentTarget as RTCPeerConnection).connectionState,
        }))
      }
      peer.peer.ondatachannel = (e) => {
        const channel = peer.onDataChannel(e)
        receiveFile(channel, fileStorage, (fs) => {
          setReceiveFiles((p) => ({
            ...p,
            [sid]: (p[sid] || []).filter((f) => f.name !== fs.name).concat(fs),
          }))
        })
      }
    })
    return () => {
      peers.forEach(({ peer }) => {
        peer.peer.onicecandidate = null
        peer.peer.onconnectionstatechange = null
        peer.peer.ondatachannel = null
        // peer.close()
      })
    }
  }, [fileStorage, id, ioEventsManager, peers, roomId])

  const createOffer = async (sid: string) => {
    const peer = peers.find((p) => p.sid === sid)
    if (!peer) {
      return
    }
    peer.peer.createDataChannel('file-transfer')
    const offer = await peer.peer.createOffer()
    ioEventsManager.publish('offer', {
      offer,
      room: roomId,
      to: sid,
      from: id,
    })
  }

  return {
    peers,
    connectionState,
    createOffer,
    receiveFiles,
    sendFiles,
    setReceiveFiles,
    setSendFiles,
  }
}

export default useRTC
