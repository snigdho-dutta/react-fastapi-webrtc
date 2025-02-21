import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import Page from '@/components/ui/page'
import { ProgressWithValue } from '@/components/ui/progress-with-value'
import { useIOClient } from '@/hooks/use-io-client'
import { useIOSubscribe } from '@/hooks/use-io-subscribe'
import useRTC from '@/hooks/use-rtc'
import { useSocketIO } from '@/hooks/use-socket'
import {
  deleteAllStoredFiles,
  deleteFile,
  downloadFile,
  getStoredFiles,
} from '@/lib/file-transfer'
import { cn, formatBytes } from '@/lib/utils'
import { FileMetadata, FileStorage } from '@/storage/indexed-db'
import {
  ArrowLeftToLine,
  Download,
  MoveDownLeft,
  MoveUpRight,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'

const RoomPage = () => {
  const { roomId } = useParams()
  const { ioEventsManager } = useSocketIO()
  const { id } = useIOClient()
  const fileStorageRef = useRef<FileStorage>(null)
  const [storedFiles, setStoredFiles] = useState<FileMetadata[]>([])

  useEffect(() => {
    fileStorageRef.current = new FileStorage()
    getStoredFiles(fileStorageRef.current).then((files) => {
      setStoredFiles(files)
    })
    ioEventsManager.publish('join_room', roomId)

    return () => {
      ioEventsManager.publish('leave_room', roomId)
      fileStorageRef.current!.close()
    }
  }, [ioEventsManager, roomId, id])

  const [files, setFiles] = useState<File[]>([])

  const updateStoredFiles = async () => {
    await getStoredFiles(fileStorageRef.current!).then((files) => {
      setStoredFiles(files)
    })
  }
  const [_error, setError] = useState<string>('')

  useIOSubscribe<{ message: string }>(
    'join_room_error',
    ({ message = 'Join Room Error' }) => {
      if (message !== _error) {
        setError(message)
        toast(message, {
          description: '',
          closeButton: true,
          richColors: true,
          style: { background: '#ff0000a4' },
          onDismiss: () => {
            setError('')
          },
        })
      }
    }
  )

  const {
    peers,
    connectionState,
    createOffer,
    closePeer,
    sendFileToConnectedPeers,
    transferFiles,
  } = useRTC(roomId!, fileStorageRef.current!, {
    onUpdateStoredFiles: updateStoredFiles,
  })

  return (
    <Page className='bg-blue-500'>
      <Card className='flex flex-col gap-4 items-center w-[98vw] justify-center'>
        <CardHeader className='xl:text-2xl font-semibold'>
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
              onClick={sendFileToConnectedPeers.bind(
                this,
                files,
                fileStorageRef.current!
              )}
            >
              Send
            </Button>
          </div>
        </CardHeader>
        <CardContent className='flex flex-col justify-between w-full text-sm gap-2'>
          <div className='flex gap-4 items-center px-4 mb-2'>
            <div className='flex flex-col sm:flex-row gap-2 items-center'>
              <h1 className='text-lg'>History</h1>
              <b className=''>No of File Transfers : {storedFiles.length}</b>
              <b className=''>
                Total Transfer Size :{' '}
                {formatBytes(storedFiles.reduce((v, f) => v + f.size, 0))}
              </b>
            </div>
            <Button
              size={'sm'}
              className='h-6 bg-green-500'
              onClick={async () => {
                storedFiles.forEach((file) => {
                  downloadFile(file.id, fileStorageRef.current!)
                })
              }}
            >
              Save All
            </Button>
            <Button
              size={'sm'}
              variant={'destructive'}
              className='h-6'
              onClick={async () => {
                await deleteAllStoredFiles(fileStorageRef.current!)
                await updateStoredFiles()
              }}
            >
              Clear All
            </Button>
          </div>
          <div className='flex flex-wrap gap-2 min-[100px]: max-h-[200px] overflow-auto text-xs font-semibold'>
            {storedFiles.map((file) => (
              <CardContent
                key={file.id}
                className={cn(
                  'p-1 flex break-all self-center border w-[200px] justify-between',
                  file.status === 'error' && 'text-red-300',
                  ['transferring', 'pending'].includes(file.status) &&
                    'text-amber-500',
                  file.status === 'completed' && 'text-green-300'
                )}
              >
                {file.transferType === 'sending' && (
                  <ArrowLeftToLine className='h-4 w-4 bg-teal-500/50 rounded text-white transition' />
                )}
                <p>{file.name}</p>
                <b>{formatBytes(file.size)}</b>
                <div className='flex gap-1 justify-between items-center'>
                  {file.transferType === 'receiving' &&
                    file.status === 'completed' && (
                      <Download
                        className='h-4 w-4 bg-green-500 cursor-pointer hover:scale-110 hover:bg-green-500/50 rounded text-white transition'
                        onClick={() => {
                          downloadFile(file.id, fileStorageRef.current!)
                        }}
                      />
                    )}

                  <X
                    className='bg-red-500 text-white rounded h-4 w-4 cursor-pointer hover:scale-110 hover:bg-red-500/50 transition'
                    onClick={async () => {
                      await deleteFile(file.id, fileStorageRef.current!)
                      await updateStoredFiles()
                    }}
                  />
                </div>
              </CardContent>
            ))}
          </div>
          <div
            className={cn(
              'flex flex-wrap gap-4 w-full h-[250px] overflow-auto items-center'
            )}
          >
            {peers
              .filter(({ sid }) => sid !== id)
              .map((peer) => (
                <Card
                  key={peer.sid}
                  className={cn(
                    'hover:shadow hover:scale-105 aspect-square grid place-items-center transition-all rounded-sm',
                    connectionState[peer.sid] === 'connected'
                      ? 'bg-green  w-[240px] h-[240px]'
                      : 'bg-red-300 rounded-full'
                  )}
                >
                  <CardContent
                    className={cn(
                      'flex flex-col justify-center items-center p-1 h-full w-full gap-1 overflow-auto'
                    )}
                  >
                    <div className='flex justify-between items-center gap-1 w-full'>
                      <b className='text-xs'>{peer.sid}</b>
                      {connectionState[peer.sid] === 'connected' && (
                        <button
                          className='bg-white cursor-pointer hover:scale-110 p-0 m-0 h-4 w-4'
                          onClick={closePeer.bind(this, peer.sid)}
                        >
                          <X className='bg-red-500 text-white rounded h-4 w-4' />
                        </button>
                      )}
                    </div>
                    {connectionState[peer.sid] !== 'connected' ? (
                      <Button
                        size={'sm'}
                        className='h-6 hover:scale-105'
                        onClick={createOffer.bind(this, peer.sid)}
                      >
                        Connect
                      </Button>
                    ) : (
                      <div className='flex flex-col w-full overflow-auto gap-2 pb-1'>
                        {Object.values(transferFiles)
                          .filter((f) => f.sid === peer.sid)
                          .map((file) => (
                            <div
                              key={file.id}
                              className={cn(
                                'flex flex-col w-full text-xs gap-1',
                                file.transferType === 'receiving'
                                  ? 'text-blue-900'
                                  : 'text-green-900'
                              )}
                            >
                              <div className='flex gap-1 items-center'>
                                <b className='break-words'>{file.name}</b>
                                <b>{formatBytes(file.size)}</b>
                                <div className='flex gap-1'>
                                  {file.transferType === 'sending' ? (
                                    <MoveUpRight className='h-4 w-4 stroke-5' />
                                  ) : (
                                    <MoveDownLeft className='h-4 w-4 stroke-5' />
                                  )}
                                </div>
                              </div>
                              <ProgressWithValue
                                value={file.progress}
                                className='h-3 bg-sky-500'
                                valueClassName='text-xs text-white'
                                barClassName={cn(
                                  'bg-sky-500',
                                  ['transferring', 'pending'].includes(
                                    file.status
                                  ) && 'bg-red-500',
                                  file.status === 'completed' && 'bg-green-500'
                                )}
                              />
                            </div>
                          ))}
                      </div>
                    )}
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
