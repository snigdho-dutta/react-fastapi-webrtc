from lib.sio import BaseEvents
from socketio import AsyncServer


class WebRTCEvents(BaseEvents):
    def __init__(self, sio: AsyncServer):
        super().__init__()
        self.register()

    def register(self):
        @self.sio.event
        def offer(sid, data):
            pass
