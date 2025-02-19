import uvicorn
import multiprocessing

if __name__ == "__main__":
    multiprocessing.freeze_support()
    num_processes = multiprocessing.cpu_count() - 1
    uvicorn.run(
        app="app:sio_manager.socket_app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        workers=num_processes,
    )
