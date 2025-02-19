// import { useEffect } from 'react'
// import { useSocketIO } from './use-socket'

import { IOClientContext } from '@/context/io-client'
import { SocketIoContext } from '@/context/socketio'
import { useEffect, useContext } from 'react'

export const useIOSubscribe = <T>(
  event: string,
  cb: (d: T, ...args: unknown[]) => void
) => {
  const { ioEventsManager } = useContext(SocketIoContext)
  const { id } = useContext(IOClientContext)
  useEffect(() => {
    return ioEventsManager.subscribe(event, cb)
  }, [cb, event, ioEventsManager, id])
}
