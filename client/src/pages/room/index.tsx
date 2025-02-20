import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import Page from '@/components/ui/page'
import { ProgressWithValue } from '@/components/ui/progress-with-value'
import { useIOClient } from '@/hooks/use-io-client'
import useRTC from '@/hooks/use-rtc'
import { useSocketIO } from '@/hooks/use-socket'
import { sendFile } from '@/lib/file-transfer'
import { cn } from '@/lib/utils'
import { FileStorage } from '@/storage/indexed-db'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'

const RoomPage = () => {
  const { roomId } = useParams()
  const { ioEventsManager } = useSocketIO()
  const { id } = useIOClient()
  const fileStorageRef = useRef<FileStorage>(null)
  useEffect(() => {
    fileStorageRef.current = new FileStorage()
    ioEventsManager.publish('join_room', roomId)
    return () => ioEventsManager.publish('leave_room', roomId)
  }, [ioEventsManager, roomId, id])

  const [files, setFiles] = useState<File[]>([])

  const sendFileToConnectedPeers = () => {
    if (!files.length) return
    peers.forEach(({ peer, sid }) => {
      for (const file of files) {
        sendFile(peer, file, (fs) => {
          setSendFiles((p) => ({
            ...p,
            [sid]: (p[sid] || [])
              .filter((f) => f.name !== file.name)
              .concat(fs),
          }))
        })
      }
    })
  }

  const {
    peers,
    connectionState,
    createOffer,
    sendFiles,
    setSendFiles,
    receiveFiles,
  } = useRTC(roomId!, fileStorageRef.current!)

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
            {/* <Button>Offer All</Button> */}
          </div>
          <div className='flex flex-col gap-2 justify-between items-center'>
            <Input
              type='file'
              multiple
              className='bg-accent text-xs'
              onChange={(e) => {
                if (e.target.files) {
                  setFiles(Array.from(e.target.files))
                }
              }}
            />
            <Button
              size={'sm'}
              className='h-6 hover:scale-105 grid place-items-center'
              onClick={sendFileToConnectedPeers}
            >
              Send
            </Button>
          </div>
        </CardHeader>
        <CardContent className='flex flex-col text-sm gap-2'>
          {Object.keys(sendFiles).some((k) => sendFiles[k]?.length > 0) && (
            <b>Receiving</b>
          )}
          <div className='self-center flex flex-wrap gap-4 items-start w-full'>
            {Object.entries(sendFiles).map(([sid, files]) => (
              <div
                key={sid}
                className='flex flex-col max-w-[280px] min-h-[280px] max-h-[280px] overflow-auto bg-sky-300 border p-1 gap-1'
              >
                <b className=''>{sid}</b>
                <div className='text-xs h-full pb-1'>
                  {files.map((file) => (
                    <div key={file.id} className='flex flex-col gap-1'>
                      <div className='flex flex-col'>
                        <p className='break-words w-full'>{file.name}</p>
                        {/* <p>{file.type}</p> */}
                      </div>
                      <ProgressWithValue
                        value={file.progress}
                        className='h-3'
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className={cn('flex gap-4')}>
            {peers
              .filter(({ sid }) => sid !== id)
              .map(({ sid }) => (
                <Card
                  key={sid}
                  className={cn(
                    'hover:shadow hover:scale-105 transition rounded-sm',
                    connectionState[sid] === 'connected'
                      ? 'bg-green-300'
                      : 'bg-red-300'
                  )}
                >
                  <CardContent
                    className={cn(
                      'flex flex-col p-1 gap-1 w-[280px] h-[280px] overflow-auto'
                    )}
                  >
                    <b className='text-sm'>{sid}</b>
                    {connectionState[sid] !== 'connected' && (
                      <Button
                        size={'sm'}
                        className='h-6 hover:scale-105'
                        onClick={createOffer.bind(this, sid)}
                      >
                        Connect
                      </Button>
                    )}
                    <div className='flex flex-col w-full gap-2 pb-1'>
                      {receiveFiles[sid]?.map((file) => (
                        <div
                          key={file.id}
                          className='flex flex-col w-full text-xs gap-1'
                        >
                          <p className='break-words'>{file.name}</p>
                          <ProgressWithValue
                            value={file.progress}
                            className='h-3'
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </CardContent>
      </Card>
    </Page>
  )
}

export default RoomPage
