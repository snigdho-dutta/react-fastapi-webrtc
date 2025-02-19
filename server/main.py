import uvicorn
import multiprocessing

if __name__ == "__main__":
    multiprocessing.freeze_support()
    num_processes = multiprocessing.cpu_count() - 1
    uvicorn.run(
        app="app:sio_manager.socket_app",
        host="0.0.0.0",
        port=10000,
        reload=True,
        workers=num_processes,
    )
