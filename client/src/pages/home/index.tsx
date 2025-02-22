import { Outlet, useNavigate } from 'react-router'
import Page from '../../components/ui/page'
import { useSocketIO } from '@/hooks/use-socket'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useIOSubscribe } from '@/hooks/use-io-subscribe'
import { useIOClient } from '@/hooks/use-io-client'
import { Clipboard, Link } from 'lucide-react/icons'
import { useState } from 'react'
const HomePage = () => {
  const { ioEventsManager } = useSocketIO()
  const { id } = useIOClient()
  const navigate = useNavigate()
  // useIOSubscribe<{ rid: string }>('room_joined', (d) => {
  //   const { rid } = d
  //   setRooms((p) => (p.includes(rid) ? p : [...p, rid]))
  //   navigate(rid)
  // })
  useIOSubscribe<{ rid: string }>('room_generated', ({ rid }) => {
    setJoinRoomId(rid)
  })

  const [joinRoomId, setJoinRoomId] = useState('')

  const joinRoom: React.MouseEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()
    navigate(joinRoomId)
    // ioEventsManager.publish('join_room', joinRoomId)
  }

  return (
    <Page className='flex bg-blue-500'>
      <Card className='min-w-[500px] text-center'>
        <CardHeader className='text-3xl font-semibold bg-gradient-to-br from-red-500  to-blue-600 text-transparent bg-clip-text'>
          P2P Media Share
        </CardHeader>
        <CardContent className='w-full text-center'>
          <form className='flex flex-col w-full gap-2' onSubmit={joinRoom}>
            <div className='flex gap-2 mt-auto items-center font-semibold'>
              <div className='relative w-full'>
                <Input
                  placeholder='Paste your room id or generate one'
                  value={joinRoomId}
                  onChange={(e) => {
                    setJoinRoomId(e.target.value)
                  }}
                />
                <Clipboard
                  size={28}
                  className='active:scale-90 absolute top-1 left-11/12 active:opacity-90 cursor-pointer'
                  onClick={() => {
                    if (joinRoomId) {
                      navigator.clipboard.writeText(joinRoomId)
                    } else {
                      navigator.clipboard.readText().then((data) => {
                        if (data.startsWith('http')) {
                          const roomId = data.split('/').slice(-1)[0].trim()
                          setJoinRoomId(roomId)
                        } else {
                          setJoinRoomId(data)
                        }
                      })
                    }
                  }}
                />
              </div>
              <Button
                type='button'
                onClick={async () => {
                  await navigator.share({
                    url: document.URL + joinRoomId,
                  })
                }}
              >
                <Link />
              </Button>
              <Button type='submit'>Join</Button>
            </div>
            <div className='flex gap-2 items-center'>
              <Label className='w-'>Client ID</Label>
              <Input className='w-min' disabled value={id} />
            </div>
            <div className='flex gap-2 items-center'>
              <Button
                className='self-center w-full'
                type='button'
                onClick={() => {
                  ioEventsManager.publish('generate_room')
                }}
              >
                Generate Room Id
              </Button>
            </div>
          </form>
        </CardContent>
        {/* <CardFooter></CardFooter> */}
      </Card>
      <Outlet />
    </Page>
  )
}

export default HomePage
