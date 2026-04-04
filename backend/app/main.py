from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.routers import memory

load_dotenv()

app = FastAPI(title="Memoria AI Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(memory.router)

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Memoria backend is running"}