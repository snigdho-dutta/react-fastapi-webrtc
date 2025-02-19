export type Peer = {
  sid: string
  peer: RTCManager
}

export default class RTCManager {
  peer: RTCPeerConnection
  dataChannel?: RTCDataChannel
  constructor(channelName?: string, cb?: (e: RTCDataChannelEvent) => void) {
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
    if (channelName) {
      this.dataChannel = this.peer.createDataChannel(channelName)
    }
    this.peer.ondatachannel = (e) => {
      console.log('ondatachannel', e)
      this.dataChannel = e.channel
      // this.dataChannel.onmessage = (e) => {
      //   console.log('dataChannel.onmessage.class', e)
      // }
      cb?.(e)
    }
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
    this.dataChannel = this.peer.createDataChannel(channelName)
  }

  close() {
    this.peer.close()
  }
}
