from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import optimize, tickers, runs, export, talking
from ai.router import router as ai_router
from utils.paths import ensure_dirs
from utils.logger import setup_logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_dirs()
    setup_logger()
    yield


app = FastAPI(
    title="Portfolio Optimizer API",
    version="0.1.0",
    lifespan=lifespan
)

# Allow all origins — server binds to 127.0.0.1 only, so this is safe
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(tickers.router, prefix="/api")
app.include_router(optimize.router, prefix="/api")
app.include_router(runs.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(talking.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
