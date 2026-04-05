from fastapi import APIRouter
from pydantic import BaseModel
from app.services.routine_service import get_routine_response

router = APIRouter(prefix="/routine", tags=["Routine Assistant"])

class RoutineRequest(BaseModel):
    query: str = "What should I do now?"  # default question

@router.post("/now")
def get_routine(request: RoutineRequest):
    result = get_routine_response(request.query)
    return result

@router.get("/now")
def get_routine_simple():
    """Quick GET version — no body needed, just hit the endpoint."""
    result = get_routine_response()
    return result