import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import Page from '@/components/ui/page'
import { useIOClient } from '@/hooks/use-io-client'
import { useIOSubscribe } from '@/hooks/use-io-subscribe'
import { useSocketIO } from '@/hooks/use-socket'
import { downloadFile, receiveFile, sendFile } from '@/lib/file-transfer'
import RTCManager, { Peer } from '@/lib/rtc-manager'
import { cn } from '@/lib/utils'
import { FileStorage } from '@/storage/indexed-db'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'

const RoomPage = () => {
  const { roomId } = useParams()
  const { ioEventsManager } = useSocketIO()
  const { roomClients, setRoomClients, id } = useIOClient()
  useIOSubscribe<{ clients: string[] }>('room_clients', ({ clients }) => {
    setRoomClients(clients)
  })
  const fileStorageRef = useRef<FileStorage>(null)
  useEffect(() => {
    fileStorageRef.current = new FileStorage()
    ioEventsManager.publish('join_room', roomId)
    return () => ioEventsManager.publish('leave_room', roomId)
  }, [ioEventsManager, roomId, id])

  const [peers, setPeers] = useState<Peer[]>([])
  const [connectionState, setConnectionState] = useState<{
    [sid: string]: string
  }>({})

  // const [_, forceRender] = useState(false)

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
            peer: new RTCManager(undefined, () =>
              setConnectionState((p) => ({ ...p, [sid]: 'connected' }))
            ),
          })),
      ]
    })
  }, [id, roomId, roomClients])

  const createOffer = async (sid: string) => {
    const peer = peers.find((p) => p.sid === sid)
    if (!peer) {
      return
    }
    peer.peer.createDataChannel('file-transfer')
    const offer = await peer.peer.createOffer()
    ioEventsManager.publish('offer', { offer, room: roomId, to: sid, from: id })
  }

  useIOSubscribe<{
    offer: RTCSessionDescriptionInit
    to: string
    from: string
  }>('offer', async ({ offer, to, from }) => {
    console.log('offer', { from, to })
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
  useIOSubscribe<{
    answer: RTCSessionDescriptionInit
    to: string
    from: string
  }>('answer', async ({ answer, to, from }) => {
    console.log('answer', { from, to })
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
    })
    return () => {
      peers.forEach(({ peer }) => {
        peer.peer.onicecandidate = null
        peer.peer.onconnectionstatechange = null
        // peer.close()
      })
    }
  }, [id, ioEventsManager, peers, roomId])

  const [file, setFile] = useState<File>()
  const [sendFileProgress, setSendFileProgress] = useState(0)

  const [receiveProgress, setReceiveProgress] = useState<
    { sid: string; progress: number }[]
  >([])

  const sendFileToConnectedPeers = () => {
    if (!file) return
    peers.forEach(({ peer }) => {
      sendFile(peer, file, setSendFileProgress)
    })
  }

  useEffect(() => {
    peers.forEach(({ peer, sid }) => {
      if (peer.dataChannel) {
        receiveFile(peer, fileStorageRef.current!, (v) => {
          setReceiveProgress((p) => {
            let existing = p.find((p) => p.sid === sid)
            if (existing) {
              existing.progress = v
            } else {
              existing = { sid, progress: v }
            }
            return [...p.filter((p) => p.sid !== sid), existing]
          })
        })
      }
    })
  }, [connectionState, peers])

  return (
    <Page className='bg-blue-500'>
      <Card className='flex flex-col gap-4 items-center justify-center'>
        <CardHeader className='text-2xl font-semibold'>
          <div className='flex gap-2'>
            <span>Room - </span>
            <span>{roomId}</span>
          </div>
          <div className='flex gap-2 w-full justify-between'>
            <div className='bg-green-500 text-slate-500 px-2 rounded'>
              <span>You - </span>
              <span>{id}</span>
            </div>
            <Button>Offer All</Button>
          </div>
          <div className='flex flex-col gap-2 justify-between items-center'>
            <Input
              type='file'
              className='bg-accent text-xs'
              onChange={(e) => {
                setFile(e.target.files?.[0])
              }}
            />
            <Button
              size={'sm'}
              className='h-6 hover:scale-105 grid place-items-center'
              onClick={sendFileToConnectedPeers}
            >
              Send
            </Button>
            <p>{sendFileProgress}%</p>
          </div>
        </CardHeader>
        <CardContent className='flex gap-2'>
          {peers
            .filter(({ sid }) => sid !== id)
            .map(({ sid }) => (
              <Card
                key={sid}
                className={cn(
                  'hover:shadow hover:scale-105 transition rounded-sm'
                )}
              >
                <CardContent
                  className={cn(
                    'm-0 p-4 gap-4 justify-baseline grid place-items-center',
                    connectionState[sid] === 'connected'
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  )}
                >
                  <div className='text-sm'>{sid}</div>
                  {connectionState[sid] !== 'connected' && (
                    <Button
                      size={'sm'}
                      className='h-6 hover:scale-105 grid place-items-center'
                      onClick={createOffer.bind(this, sid)}
                    >
                      Offer
                    </Button>
                  )}
                  <p>{receiveProgress.find((p) => p.sid === sid)?.progress}</p>
                  <Button
                    onClick={downloadFile.bind(
                      this,
                      's',
                      fileStorageRef.current!
                    )}
                  >
                    Download
                  </Button>
                </CardContent>
              </Card>
            ))}
        </CardContent>
      </Card>
    </Page>
  )
}

export default RoomPage
