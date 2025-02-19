import { useIOSubscribe } from '@/hooks/use-io-subscribe'
import { useSocketIO } from '@/hooks/use-socket'
import React, { useState } from 'react'

type IOClient = {
  id: string
  clients: string[]
  rooms: string[]
  setId: React.Dispatch<React.SetStateAction<string>>
  setClients: React.Dispatch<React.SetStateAction<IOClient['clients']>>
  setRooms: React.Dispatch<React.SetStateAction<IOClient['rooms']>>
  roomClients: string[]
  setRoomClients: React.Dispatch<React.SetStateAction<IOClient['roomClients']>>
}

export const IOClientContext = React.createContext<IOClient>({} as IOClient)

const IOClientProvider = ({ children }: { children: React.ReactNode }) => {
  const [id, setId] = useState<string>('')
  const [clients, setClients] = useState<IOClient['clients']>([])
  const [rooms, setRooms] = useState<IOClient['rooms']>([])
  const { ioEventsManager } = useSocketIO()
  const [roomClients, setRoomClients] = useState<IOClient['roomClients']>([])
  useIOSubscribe('connect', () => {
    console.log('connect', ioEventsManager.socket.id)
    setId(ioEventsManager.socket.id!)
  })

  return (
    <IOClientContext.Provider
      value={{
        id,
        setId,
        clients,
        setClients,
        rooms,
        setRooms,
        roomClients,
        setRoomClients,
      }}
    >
      {children}
    </IOClientContext.Provider>
  )
}

export default IOClientProvider
