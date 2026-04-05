from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.task_service import (
    get_task_response, get_current_tasks,
    add_task, mark_task_complete, delete_task,
    get_todays_tasks, load_tasks
)

router = APIRouter(tags=["Tasks & Caregiver"])

# ── Patient Endpoints ──────────────────────────────

class TaskQueryRequest(BaseModel):
    query: str = "What do I have today?"

@router.post("/tasks/ask")
def ask_about_tasks(request: TaskQueryRequest):
    """Patient asks about their schedule."""
    return get_task_response(request.query)

@router.get("/tasks/check-now")
def check_now():
    """
    Frontend polls this every 60 seconds.
    Returns alert=true if a task is happening RIGHT NOW.
    """
    current = get_current_tasks()
    if current:
        titles = ", ".join([t["title"] for t in current])
        return {
            "alert": True,
            "message": f"It's time to: {titles}",
            "tasks": current
        }
    return {"alert": False, "tasks": []}

@router.get("/tasks/today")
def get_today():
    """Get all of today's tasks."""
    return {"tasks": get_todays_tasks()}

# ── Caregiver Endpoints ────────────────────────────

class NewTaskRequest(BaseModel):
    title: str
    time: str              # "HH:MM" format e.g. "09:00"
    date: str              # "YYYY-MM-DD" format e.g. "2026-04-06"
    category: Optional[str] = "general"
    notes: Optional[str] = ""

@router.post("/caregiver/tasks")
def create_task(request: NewTaskRequest):
    """Caregiver creates a new task for the patient."""
    task = add_task(
        title=request.title,
        time=request.time,
        date=request.date,
        category=request.category,
        notes=request.notes
    )
    return {"success": True, "task": task}

@router.get("/caregiver/tasks")
def get_all_tasks():
    """Caregiver views all tasks."""
    return {"tasks": load_tasks()}

@router.patch("/caregiver/tasks/{task_id}/complete")
def complete_task(task_id: str):
    """Mark a task as completed."""
    success = mark_task_complete(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True}

@router.delete("/caregiver/tasks/{task_id}")
def remove_task(task_id: str):
    """Caregiver deletes a task."""
    success = delete_task(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True}