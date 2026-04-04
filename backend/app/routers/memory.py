from fastapi import APIRouter
from pydantic import BaseModel
from app.services.memory_service import recall_person

router = APIRouter(prefix="/memory", tags=["Memory"])

class QueryRequest(BaseModel):
    query: str

@router.post("/recall")
def recall_memory(request: QueryRequest):
    result = recall_person(request.query)
    return {"query": request.query, "result": result}