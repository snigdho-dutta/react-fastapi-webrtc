export default class RTCManager {
  sid: string
  peer: RTCPeerConnection
  dataChannels: RTCDataChannel[]
  constructor(sid: string, channelName?: string) {
    this.sid = sid
    this.peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
          ],
        },
      ],
    })
    this.dataChannels = []
    if (channelName) {
      this.dataChannels?.push(this.peer.createDataChannel(channelName))
    }
    // this.peer.ondatachannel = (e) => {
    //   const index = this.dataChannels.findIndex(
    //     (c) => c.label === e.channel.label
    //   )
    //   if (index !== -1) {
    //     const existingDataChannel = this.dataChannels.splice(index, 1).pop()
    //     existingDataChannel?.close()
    //   } else {
    //     this.dataChannels.push(e.channel)
    //   }

    //   cb?.(e)
    // }
  }

  async createOffer() {
    const offer = await this.peer.createOffer()
    await this.peer.setLocalDescription(offer)
    return offer
  }

  async acceptOffer(offer: RTCSessionDescriptionInit) {
    await this.peer.setRemoteDescription(new RTCSessionDescription(offer))
  }

  async createAnswer() {
    const answer = await this.peer.createAnswer()
    await this.peer.setLocalDescription(answer)
    return answer
  }

  async acceptAnswer(answer: RTCSessionDescriptionInit) {
    await this.peer.setRemoteDescription(new RTCSessionDescription(answer))
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    await this.peer.addIceCandidate(candidate)
  }

  createDataChannel(channelName: string) {
    const index = this.dataChannels.findIndex((c) => c.label === channelName)
    if (index === -1 || this.dataChannels[index].readyState === 'closed') {
      const dataChannel = this.peer.createDataChannel(channelName)
      this.dataChannels.push(dataChannel)
      return dataChannel
    }
    return this.dataChannels[index]
  }

  onDataChannel(e: RTCDataChannelEvent) {
    const index = this.dataChannels.findIndex(
      (c) => c.label === e.channel.label
    )
    if (index !== -1) {
      const existingDataChannel = this.dataChannels.splice(index, 1).pop()
      existingDataChannel?.close()
    }
    this.dataChannels.push(e.channel)
    return e.channel
  }

  closeDataChannel(channelName: string) {
    this.dataChannels.find((c) => c.label === channelName)?.close()
    this.dataChannels = this.dataChannels.filter((c) => c.label !== channelName)
  }

  close() {
    this.peer.close()
    this.dataChannels = []
  }
}
