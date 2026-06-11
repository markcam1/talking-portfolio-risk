import sys
import multiprocessing

multiprocessing.freeze_support()

if __name__ == '__main__':
    import uvicorn
    from main import app  # noqa: F401 — forces PyInstaller to include all app modules

    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    uvicorn.run(app, host='127.0.0.1', port=port, log_level='error', access_log=False)
