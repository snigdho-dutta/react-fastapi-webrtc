import { Socket } from 'socket.io-client'

type EventListeners = Map<string, Set<CallableFunction>>

// type EventEmitters = Map<string, unknown>

export default class IOEventsManager {
  socket: Socket
  private eventListeners: EventListeners
  // private eventEmitters: EventEmitters

  constructor(socket: Socket) {
    this.socket = socket
    this.eventListeners = new Map()
  }

  initialize() {
    if (!this.socket.connected) {
      this.socket.connect()
    }
    this.socket.on('connect', () => {
      console.log('connected', this.socket.id)
    })
    this.socket.on('disconnect', () => {
      // this.socket.removeAllListeners()
      console.log('disconnected', this.socket.id)
      // this.socket.connect()
    })
    return () => {
      if (this.socket.connected) {
        this.socket.disconnect()
      }
    }
  }

  subscribe<T = unknown>(
    event: string,
    cb: (payload: T, ...args: unknown[]) => void
  ) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(cb)
    this.socket.on(event, cb)
    return () => {
      if (event === 'connect') {
        return
      }
      this.socket.off(event, cb)
      this.eventListeners.get(event)!.delete(cb)
      if (this.eventListeners.size === 0) {
        this.eventListeners.delete(event)
      }
    }
  }

  publish<T = unknown>(event: string, payload?: T, ...args: unknown[]) {
    // if (!this.eventEmitters.has(event)) {
    //   this.eventEmitters.set(event, payload)
    // }
    this.socket.emit(event, payload, ...args)
  }
}
