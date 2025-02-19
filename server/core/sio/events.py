from lib.sio import BaseEvents
from socketio import AsyncServer
from core.sio.sio_manager import SocketIOManager


class WebRTCEvents(BaseEvents):
    def __init__(self, sio_manager: SocketIOManager):
        super().__init__()
        self.sio_manager = sio_manager
        self.register()

    def register(self):
        @self.sio_manager.sio.event
        async def offer(sid: str, data: dict):
            room = data.get("room")
            offer = data.get("offer")
            to_sid = data.get("to")
            from_sid = data.get("from")
            print(f"Received offer from {sid} in room {room}")
            if room and offer:
                await self.sio_manager.sio.emit(
                    "offer",
                    {
                        "to": to_sid,
                        "from": from_sid,
                        "offer": offer,
                    },
                    to=to_sid,
                    room=room,
                )

        @self.sio_manager.sio.event
        async def answer(sid: str, data: dict):
            room = data.get("room")
            answer = data.get("answer")
            to_sid = data.get("to")
            from_sid = data.get("from")
            print(f"Received answer from {sid} in room {room}")
            if room and answer:
                await self.sio_manager.sio.emit(
                    "answer",
                    {
                        "to": to_sid,
                        "from": from_sid,
                        "answer": answer,
                    },
                    to=to_sid,
                    room=room,
                )

        @self.sio_manager.sio.event
        async def ice_candidate(sid: str, data: dict):
            room = data.get("room")
            candidate = data.get("candidate")
            to_sid = data.get("to")
            from_sid = data.get("from")
            print(f"Received candidate from {sid} in room {room}")
            if room and candidate:
                await self.sio_manager.sio.emit(
                    "ice_candidate",
                    {
                        "to": to_sid,
                        "from": from_sid,
                        "candidate": candidate,
                    },
                    to=to_sid,
                    room=room,
                )
