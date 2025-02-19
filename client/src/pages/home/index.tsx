import { Outlet, useNavigate } from 'react-router'
import Page from '../../components/ui/page'
import { useSocketIO } from '@/hooks/use-socket'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useIOSubscribe } from '@/hooks/use-io-subscribe'
import { useIOClient } from '@/hooks/use-io-client'
import { ClipboardCopy } from 'lucide-react/icons'
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
    setGeneratedRoomId(rid)
  })

  const [generatedRoomId, setGeneratedRoomId] = useState('')

  const [joinRoomId, setJoinRoomId] = useState('')

  const joinRoom: React.MouseEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()
    navigate(joinRoomId)
    // ioEventsManager.publish('join_room', joinRoomId)
  }

  return (
    <Page className='flex bg-blue-500'>
      <Card>
        <CardHeader>P2P Media Share</CardHeader>
        <CardContent>
          <form className='flex flex-col  gap-2' onSubmit={joinRoom}>
            <div className='flex gap-2 mt-auto items-center'>
              <Input
                placeholder='Paste your room id or generate one'
                value={joinRoomId}
                onChange={(e) => {
                  setJoinRoomId(e.target.value)
                }}
              />
              <Button onClick={() => {}}>Join</Button>
            </div>
            <div className='flex gap-2 items-center'>
              <Label className='w-'>Client ID</Label>
              <Input className='w-min' disabled value={id} />
            </div>
            <div className='flex gap-2 items-center'>
              <Label>Room ID</Label>
              <Input className='w-min' value={generatedRoomId} />
              <ClipboardCopy
                className='active:scale-90 active:opacity-90 cursor-pointer'
                onClick={() => {
                  navigator.clipboard.writeText(generatedRoomId)
                }}
              />
              <Button
                type='button'
                onClick={() => {
                  ioEventsManager.publish('generate_room')
                }}
              >
                Generate
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
