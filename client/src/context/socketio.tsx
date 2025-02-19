import IOEventsManager from '@/lib/events-manager'
import { createContext, FC, PropsWithChildren, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

type SocketIOContextType = {
  ioEventsManager: IOEventsManager
  // isSocketInitialized: boolean
}

export const SocketIoContext = createContext<SocketIOContextType>(
  {} as SocketIOContextType
)

const SocketIOContextProvider: FC<PropsWithChildren> = ({ children }) => {
  const ioEventsManagerRef = useRef<IOEventsManager>(null)

  ioEventsManagerRef.current = new IOEventsManager(
    io({
      transports: ['websocket'],
    })
  )
  useEffect(() => {
    return ioEventsManagerRef.current!.initialize()
  }, [])

  return (
    <SocketIoContext.Provider
      value={{
        ioEventsManager: ioEventsManagerRef.current!,
      }}
    >
      {children}
    </SocketIoContext.Provider>
  )
}

export default SocketIOContextProvider
