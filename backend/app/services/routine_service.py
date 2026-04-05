import json
from datetime import datetime
from app.services.llm_service import ask_llm

ROUTINES_PATH = "data/routines.json"

ROUTINE_SYSTEM_PROMPT = """
You are a gentle AI assistant helping someone with dementia follow their daily routine.
You will be given the current time and a list of routine steps for that time of day.
Respond warmly and simply in 2-3 sentences.
Tell them what time it is and guide them to their next step.
Speak directly to them. Be encouraging and calm.
Never mention dementia or memory loss.
Example: "Good morning! It's 9 AM. Time to take your morning medication — you're doing great."
"""

def get_current_period() -> dict:
    """Get the routine block that matches the current hour."""
    with open(ROUTINES_PATH, "r") as f:
        routines = json.load(f)

    current_hour = datetime.now().hour

    for routine in routines:
        start = routine["time_range"]["start"]
        end = routine["time_range"]["end"]

        # Handle overnight period (e.g., 22 to 6)
        if start > end:
            if current_hour >= start or current_hour < end:
                return routine
        else:
            if start <= current_hour < end:
                return routine

    return routines[0]  # fallback to morning

def get_routine_response(user_query: str = "What should I do now?") -> dict:
    """Return the current routine with a natural LLM response."""
    routine = get_current_period()
    now = datetime.now()
    time_str = now.strftime("%I:%M %p")  # e.g. "09:30 AM"

    steps_text = "\n".join([f"- {step}" for step in routine["steps"]])

    natural_response = ask_llm(
        system_prompt=ROUTINE_SYSTEM_PROMPT,
        user_message=(
            f"Current time: {time_str}\n"
            f"Period: {routine['period']}\n"
            f"Routine steps for this time:\n{steps_text}\n\n"
            f"User asked: '{user_query}'"
        )
    )

    return {
        "period": routine["period"],
        "current_time": time_str,
        "steps": routine["steps"],
        "response": natural_response
    }