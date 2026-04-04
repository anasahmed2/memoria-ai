from fastapi import APIRouter
from pydantic import BaseModel
from app.services.graph_service import process_message

router = APIRouter(prefix="/chat", tags=["Chat (Main Entry Point)"])

class ChatRequest(BaseModel):
    message: str

@router.post("/")
def chat(request: ChatRequest):
    """
    The main endpoint — send any message and the AI figures out what to do.
    This is what the frontend will call for everything.
    """
    return process_message(request.message)