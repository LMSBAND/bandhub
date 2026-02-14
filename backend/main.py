import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from routers import bands, media, comments, calendar

app = FastAPI(title="LMS BandHub API", version="0.1.0")

# CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(bands.router)
app.include_router(media.router)
app.include_router(comments.router)
app.include_router(calendar.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "LMS BandHub"}


# In production, serve the built frontend as static files
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
