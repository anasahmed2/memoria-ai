import json
import uuid
from datetime import datetime, timezone, timedelta
from app.services.llm_service import ask_llm

TASKS_PATH = "data/tasks.json"

TASK_SYSTEM_PROMPT = """
You are a gentle AI assistant helping someone with dementia know what they need to do today.
You will be given their task list with times.
Respond warmly and simply in 2-3 sentences.
If something is happening RIGHT NOW or very soon, gently highlight it.
Be encouraging and calm. Use simple language.
Never mention dementia or memory loss.
Example: "Good afternoon! You have a call with Sarah coming up at 2 PM — 
          she's looking forward to hearing from you."
"""

def load_tasks() -> list:
    try:
        with open(TASKS_PATH, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_tasks(tasks: list):
    with open(TASKS_PATH, "w") as f:
        json.dump(tasks, f, indent=2)

def get_todays_tasks() -> list:
    tasks = load_tasks()
    today = datetime.now().strftime("%Y-%m-%d")
    return [t for t in tasks if t.get("date") == today]

def parse_task_datetime(task: dict) -> datetime | None:
    """Parse a task's date/time, supporting both 24h and 12h time formats."""
    date_str = task.get("date", "")
    time_str = task.get("time", "")
    if not date_str or not time_str:
        return None

    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %I:%M %p"):
        try:
            return datetime.strptime(f"{date_str} {time_str}", fmt)
        except ValueError:
            continue
    return None

def get_upcoming_tasks(minutes_ahead: int = 120) -> list:
    """Get tasks happening in the next X minutes."""
    tasks = get_todays_tasks()
    now = datetime.now()
    upcoming = []

    for task in tasks:
        if task.get("completed"):
            continue
        try:
            task_time = parse_task_datetime(task)
            if task_time is None:
                continue
            diff_minutes = (task_time - now).total_seconds() / 60
            if 0 <= diff_minutes <= minutes_ahead:
                upcoming.append({
                    **task,
                    "minutes_until": int(diff_minutes)
                })
        except Exception:
            continue

    return sorted(upcoming, key=lambda x: x["minutes_until"])

def get_current_tasks() -> list:
    """Get tasks happening RIGHT NOW (within ±5 min window)."""
    tasks = get_todays_tasks()
    now = datetime.now()
    current = []

    for task in tasks:
        if task.get("completed"):
            continue
        try:
            task_time = parse_task_datetime(task)
            if task_time is None:
                continue
            diff_minutes = abs((task_time - now).total_seconds() / 60)
            if diff_minutes <= 5:
                current.append(task)
        except Exception:
            continue

    return current

def add_task(title: str, time: str, date: str,
             category: str = "general", notes: str = "") -> dict:
    """Add a new task (called by caregiver dashboard)."""
    tasks = load_tasks()
    new_task = {
        "id": str(uuid.uuid4()),
        "title": title,
        "time": time,
        "date": date,
        "category": category,
        "notes": notes,
        "completed": False
    }
    tasks.append(new_task)
    save_tasks(tasks)
    return new_task

def mark_task_complete(task_id: str) -> bool:
    """Mark a task as done."""
    tasks = load_tasks()
    for task in tasks:
        if task["id"] == task_id:
            task["completed"] = True
            save_tasks(tasks)
            return True
    return False

def delete_task(task_id: str) -> bool:
    """Delete a task (caregiver can remove it)."""
    tasks = load_tasks()
    updated = [t for t in tasks if t["id"] != task_id]
    if len(updated) < len(tasks):
        save_tasks(updated)
        return True
    return False

def get_task_response(user_query: str = "What do I have today?") -> dict:
    """Return task-aware natural language response."""
    upcoming = get_upcoming_tasks(minutes_ahead=180)
    current = get_current_tasks()
    now = datetime.now()
    time_str = now.strftime("%I:%M %p")

    if not upcoming and not current:
        future_pending = []
        for task in load_tasks():
            if task.get("completed"):
                continue
            task_dt = parse_task_datetime(task)
            if task_dt is None or task_dt < now:
                continue
            future_pending.append({**task, "task_dt": task_dt})

        if future_pending:
            future_pending.sort(key=lambda x: x["task_dt"])
            next_task = future_pending[0]
            when_label = "tomorrow" if next_task["task_dt"].date() == (now.date() + timedelta(days=1)) else next_task["task_dt"].strftime("%A")
            next_time = next_task["task_dt"].strftime("%I:%M %p")
            return {
                "current_time": time_str,
                "current_tasks": [],
                "upcoming_tasks": [],
                "response": (
                    f"It's {time_str}. You don't have anything else scheduled today. "
                    f"Your next task is {next_task.get('title', 'a task')} on {when_label} at {next_time}."
                )
            }

        return {
            "current_time": time_str,
            "current_tasks": [],
            "upcoming_tasks": [],
            "response": f"It's {time_str}. You have nothing scheduled for the next few hours — enjoy your free time!"
        }

    event_lines = []
    for t in current:
        note = f" — {t['notes']}" if t.get("notes") else ""
        event_lines.append(f"🔴 RIGHT NOW: {t['title']}{note}")
    for t in upcoming:
        note = f" — {t['notes']}" if t.get("notes") else ""
        event_lines.append(f"⏰ In {t['minutes_until']} min: {t['title']}{note}")

    natural_response = ask_llm(
        system_prompt=TASK_SYSTEM_PROMPT,
        user_message=(
            f"Current time: {time_str}\n"
            f"User asked: '{user_query}'\n\n"
            f"Today's tasks:\n" + "\n".join(event_lines)
        )
    )

    return {
        "current_time": time_str,
        "current_tasks": current,
        "upcoming_tasks": upcoming,
        "response": natural_response
    }