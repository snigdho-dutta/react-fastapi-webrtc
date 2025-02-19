from fastapi import FastAPI, HTTPException, Response, status, Request
from core.sio.sio_manager import SocketIOManager
from core.sio.events import WebRTCEvents
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sio_manager = SocketIOManager(app, events=[WebRTCEvents])


@app.get("/api/health", status_code=200)
async def root():
    return {"message": "OK"}


dist_dir = os.path.join(os.getcwd(), "..", "client", "dist")

if os.path.exists(dist_dir):
    print(f"Serving from static directory {dist_dir}")
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(dist_dir, "assets")),
        name="assets",
    )

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        return FileResponse(os.path.join(dist_dir, "index.html"))


if __name__ == "__main__":
    uvicorn.run(sio_manager.socket_app)
