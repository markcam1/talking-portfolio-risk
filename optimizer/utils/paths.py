import os
import sys
from pathlib import Path


def get_app_data_dir() -> Path:
    """Return the userData directory.

    In production, Electron passes APP_DATA_PATH as an env variable.
    In development, falls back to a local dev-data/ folder next to backend/.
    """
    env_path = os.environ.get("APP_DATA_PATH")
    if env_path:
        return Path(env_path)

    # Development fallback — sibling of backend/
    backend_dir = Path(__file__).parent.parent
    dev_dir = backend_dir.parent / "dev-data"
    return dev_dir


def get_runs_dir() -> Path:
    return get_app_data_dir() / "runs"


def get_logs_dir() -> Path:
    return get_app_data_dir() / "logs"


def ensure_dirs() -> None:
    get_runs_dir().mkdir(parents=True, exist_ok=True)
    get_logs_dir().mkdir(parents=True, exist_ok=True)
