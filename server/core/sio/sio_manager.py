from socketio import AsyncServer, ASGIApp
from fastapi import FastAPI
from lib.sio import BaseEvents
from collections import defaultdict
from typing import Dict, List, Set
import uuid
from fastapi.routing import APIRouter

MAX_ROOMS = 1024
MAX_CLIENTS_PER_ROOM = 8
MAX_ROOMS_PER_CLIENT = 8


class SocketIOManager:
    def __init__(self, app: FastAPI, events: List[BaseEvents]) -> ASGIApp:
        self.app = app
        self.sio = AsyncServer(
            cors_allowed_origins="*",
            async_mode="asgi",
        )
        self.socket_app = ASGIApp(self.sio, self.app)
        self.connected_clients: Set[str] = set()
        self.rooms: Dict[str, Set[str]] = defaultdict(set)

        self.register_core_events()
        self.register_routes()
        # Register socketio events
        for _event in events:
            if issubclass(_event, BaseEvents):
                _event(self)

    def register_routes(self) -> None:
        router = APIRouter(prefix="/sio")

        @router.get("/clients", response_model=List[str])
        def get_clients():
            return self.connected_clients

        @router.get("/rooms", response_model=Dict[str, Set[str]])
        def get_rooms():
            return self.rooms

        @router.get("/rooms/{sid}", response_model=Set[str])
        def get_rooms(sid: str) -> Set[str]:
            rooms = [k for k, v in self.rooms.items() if sid in v]
            return rooms

        self.app.include_router(router)

    def register_core_events(self):

        @self.sio.event
        def connect(sid, environ):
            if sid not in self.connected_clients:
                self.connected_clients.add(sid)

        @self.sio.event
        async def disconnect(sid):
            if sid in self.connected_clients:
                self.connected_clients.remove(sid)
            rooms = []
            for room in list(self.rooms.keys()):
                if sid in self.rooms[room]:
                    await self.sio.leave_room(sid, room)
                    self.rooms[room].remove(sid)
                    if not len(self.rooms[room]):
                        self.rooms.pop(room)
                    else:
                        rooms.append(room)

            for room in rooms:
                await self.sio.emit(
                    "room_clients", {"clients": list(self.rooms.get(room))}, room=room
                )

        @self.sio.event
        async def join_room(sid, room):
            try:
                uuid.UUID(room)
            except ValueError:
                print("Invalid room id")
                self.sio.emit("join_room_error", {"message": "Invalid room id"}, to=sid)
                return
            if room not in self.rooms:
                if len(self.rooms.keys()) <= MAX_ROOMS:
                    self.rooms[room] = set()
                else:
                    self.sio.emit(
                        "join_room_error", {"message": "Rooms limit exceeded"}, to=sid
                    )
                    return
            if sid not in self.rooms[room]:
                if len(self.rooms[room]) <= MAX_CLIENTS_PER_ROOM:
                    await self.sio.enter_room(sid, room)
                    self.rooms[room].add(sid)
                    await self.sio.emit(
                        "room_joined",
                        {"sid": sid, "rid": room},
                        to=sid,
                        # skip_sid=sid,
                    )
                else:
                    await self.sio.emit(
                        "join_room_error", {"message": "Clients limit exceeded"}, to=sid
                    )
                    return
            await self.sio.emit(
                "room_clients", {"clients": list(self.rooms.get(room))}, room=room
            )

        @self.sio.event
        async def leave_room(sid, room):
            if sid in self.rooms[room]:
                await self.sio.leave_room(sid, room)
                self.rooms[room].remove(sid)
                await self.sio.emit(
                    "room_left",
                    {"sid": sid, "rid": room},
                    room=room,
                    # skip_sid=sid,
                )
                await self.sio.emit(
                    "room_clients", {"clients": list(self.rooms.get(room))}, room=room
                )

        @self.sio.event
        async def generate_room(sid, data):
            rid = uuid.uuid5(uuid.NAMESPACE_OID, sid).hex
            print("Generated room", rid)
            await self.sio.emit(
                "room_generated",
                {"rid": rid},
                room=sid,
                # skip_sid=sid,
            )

        @self.sio.event
        def get_rooms(sid):
            rooms = set()
            for room in self.sio.rooms:
                if sid in room:
                    rooms.add(room)
            return rooms

        @self.sio.event
        def get_clients(sid):
            return self.connected_clients

        @self.sio.event
        async def get_room_clients(sid, room):
            print(f"Requesting room clients for {room}")
            print(self.rooms.get(room))
            await self.sio.emit(
                "room_clients", {"clients": list(self.rooms.get(room))}, room=room
            )
