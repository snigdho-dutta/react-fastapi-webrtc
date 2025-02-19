import { useContext } from 'react'
import { SocketIoContext } from '../context/socketio'

export const useSocketIO = () => {
  return useContext(SocketIoContext)
}
