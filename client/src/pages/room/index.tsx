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
  getStoredFiles,
} from '@/lib/file-transfer'
import { cn, formatBytes } from '@/lib/utils'
import { FileMetadata, FileStorage } from '@/storage/indexed-db'
import {
  ArrowLeftToLine,
  Download,
  Loader,
  MoveDownLeft,
  MoveUpRight,
  Redo,
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
  const [error, setError] = useState<string>('')

  useIOSubscribe<{ message: string }>(
    'join_room_error',
    ({ message = 'Join Room Error' }) => {
      if (message !== error) {
        setError(message)
        toast(message, {
          closeButton: true,
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

  const [isDownloading, setIsDownloading] = useState<{
    [fileId: string]: boolean
  }>({})

  const downloadFile = (fileId: string) => {
    return new Promise<void>((resolve, reject) => {
      const worker = new Worker(
        new URL('../../workers/file-downloader.ts', import.meta.url),
        { type: 'module' }
      )
      setIsDownloading((p) => ({ ...p, [fileId]: true }))

      worker.postMessage({ fileId })

      worker.onmessage = (ev) => {
        const { blob, metadata } = ev.data as {
          blob: Blob
          metadata: FileMetadata
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = metadata.name
        document.body.appendChild(a)
        a.click()
        requestAnimationFrame(() => {
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        })
        worker.terminate()
        setIsDownloading((p) => ({ ...p, [fileId]: false }))
        resolve()
      }
      worker.onerror = (ev) => {
        worker.terminate()
        reject(ev)
      }
    })
  }

  const downloadAllFiles = () => {
    const downloadFilePromises = storedFiles.map((file) => {
      return downloadFile(file.id)
    })

    Promise.all(downloadFilePromises).then(() => {})
  }

  return (
    <Page className='bg-blue-500'>
      <Card className='flex flex-col gap-4 items-center w-[98vw] h-[98vh] justify-between overflow-auto'>
        <CardHeader className='xl:text-2xl font-semibold'>
          <div className='flex gap-2'>
            <span>Room - </span>
            <span>{roomId}</span>
          </div>
          <div className='flex gap-2 w-full justify-between'>
            <div className='bg-green-500 text-white px-2 rounded'>
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
        <CardContent className='flex flex-col justify-between w-full h-full text-sm gap-2'>
          <div className='flex flex-col sm:flex-row gap-4 items-center px-4 mb-2'>
            <div className='flex flex-col w-11/12 sm:flex-row gap-2 items-center'>
              <h1 className='text-lg'>History</h1>
              <b className=''>No of File Transfers : {storedFiles.length}</b>
              <b className=''>
                Total Transfer Size :{' '}
                {formatBytes(storedFiles.reduce((v, f) => v + f.size, 0))}
              </b>
            </div>
            <div className='flex w-full sm:w-auto gap-2 justify-between'>
              <Button
                size={'sm'}
                className='h-6 bg-green-500 hover:bg-green-600'
                onClick={downloadAllFiles}
              >
                Download All
              </Button>
              <Button
                size={'sm'}
                variant={'destructive'}
                className='h-6 hover:bg-red-700'
                onClick={async () => {
                  await deleteAllStoredFiles(fileStorageRef.current!)
                  await updateStoredFiles()
                }}
              >
                Clear All
              </Button>
            </div>
          </div>
          <div className='flex flex-wrap gap-2 overflow-auto text-xs font-semibold max-h-[200px] justify-center sm:justify-around'>
            {storedFiles.map((file) => (
              <CardContent
                key={file.id}
                className={cn(
                  'p-1 flex break-all border w-full max-w-[360px] sm:max-w-[300px] justify-between items-center',
                  file.status === 'error' && 'text-red-300',
                  ['transferring', 'pending'].includes(file.status) &&
                    'text-amber-500',
                  file.status === 'completed' && 'text-green-300'
                )}
              >
                <p className='w-1/2'>{file.name}</p>
                <b>{formatBytes(file.size)}</b>
                <div className='flex gap-2 justify-between items-center'>
                  {file.transferType === 'receiving' &&
                  file.status === 'completed' ? (
                    <button
                      onClick={async () => {
                        await downloadFile(file.id)
                      }}
                      disabled={isDownloading[file.id]}
                    >
                      {isDownloading[file.id] ? (
                        <Loader className='animate-spin stroke-5' />
                      ) : (
                        <Download className='bg-green-500 cursor-pointer hover:scale-110 hover:bg-green-500/50 rounded text-white transition' />
                      )}
                    </button>
                  ) : file.transferType === 'sending' &&
                    file.status === 'completed' ? (
                    <ArrowLeftToLine className='bg-teal-500/50 rounded text-white transition' />
                  ) : (
                    <>
                      <Redo />
                    </>
                  )}
                  <button
                    onClick={async () => {
                      await deleteFile(file.id, fileStorageRef.current!)
                      await updateStoredFiles()
                    }}
                    disabled={isDownloading[file.id]}
                  >
                    <X className='bg-red-500 text-white rounded cursor-pointer hover:scale-110 hover:bg-red-500/50 transition' />
                  </button>
                </div>
              </CardContent>
            ))}
          </div>
          <div
            className={cn(
              'flex flex-wrap gap-4 w-full max-h-1/2 overflow-aut items-center justify-center sm:justify-around'
            )}
          >
            {peers
              .filter(({ sid }) => sid !== id)
              .map((peer) => (
                <Card
                  key={peer.sid}
                  className={cn(
                    'hover:shadow hover:scale-105 grid place-items-center transition-all rounded-sm w-full max-w-[360px] sm:max-w-[300px] h-[240px]',
                    connectionState[peer.sid] === 'connected'
                      ? 'bg-green'
                      : 'bg-red-300 w-[240px] rounded-full'
                  )}
                >
                  <CardContent
                    className={cn(
                      'flex flex-col items-center p-1 h-full w-full gap-1 overflow-auto',
                      connectionState[peer.sid] === 'connected'
                        ? 'justify-between'
                        : 'justify-center'
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center gap-1 w-full',
                        connectionState[peer.sid] === 'connected'
                          ? 'justify-between'
                          : 'justify-center'
                      )}
                    >
                      <b className='text-xs bg-green-500 px-1 text-white rounded'>
                        {peer.sid}
                      </b>
                      {connectionState[peer.sid] === 'connected' && (
                        <button
                          className='text-white bg-red-500 cursor-pointer text-[10px] hover:scale-110 h-4 rounded px-1 font-semibold'
                          onClick={closePeer.bind(this, peer.sid)}
                        >
                          Disconnect
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
                    ) : !Object.values(transferFiles).length ? (
                      <div className='flex-1 content-center'>
                        <p>No files transferred yet!</p>
                      </div>
                    ) : (
                      <div className='flex h-full flex-col w-full overflow-auto gap-2 pb-1'>
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
                                <b className='break-words w-3/4'>{file.name}</b>
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
                                  ) && 'bg-amber-500',
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
