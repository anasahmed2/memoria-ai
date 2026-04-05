from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from app.routers import memory, calming, routine, chat, tasks, voice, location

load_dotenv()

app = FastAPI(title="Memoria AI Backend", version="0.1.0")

photos_path = Path(__file__).resolve().parents[1] / "photos"
app.mount("/photos", StaticFiles(directory=photos_path), name="photos")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(memory.router)
app.include_router(calming.router)
app.include_router(routine.router)
app.include_router(chat.router)
app.include_router(tasks.router)
app.include_router(voice.router)
app.include_router(location.router)

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Memoria backend is running"}