from fastapi import APIRouter
from pydantic import BaseModel
from app.services.calming_service import get_calming_response, is_calming_trigger

router = APIRouter(prefix="/calming", tags=["Calming Mode"])

class MessageRequest(BaseModel):
    message: str

@router.post("/respond")
def calming_respond(request: MessageRequest):
    is_triggered = is_calming_trigger(request.message)
    response = get_calming_response(request.message)
    return {
        "message": request.message,
        "triggered": is_triggered,
        "response": response
    }