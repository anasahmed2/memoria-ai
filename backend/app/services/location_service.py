from app.services.llm_service import ask_llm

LOCATION_SYSTEM_PROMPT = """
You are a gentle AI assistant for someone with dementia.
They are asking where they are. Reassure them calmly and simply.
Tell them they are at home and everything is okay.
Keep it to 2-3 sentences. Be warm and grounding.
Never mention dementia or memory loss.
"""

# In a real app this would come from GPS or caregiver input
STORED_LOCATION = {
    "place": "home",
    "description": "your apartment in Vancouver",
    "safe": True
}

def get_location_response(query: str) -> dict:
    response = ask_llm(
        system_prompt=LOCATION_SYSTEM_PROMPT,
        user_message=(
            f"User asked: '{query}'\n"
            f"Their actual location: {STORED_LOCATION['description']}"
        )
    )
    return {
        "location": STORED_LOCATION["description"],
        "safe": STORED_LOCATION["safe"],
        "response": response
    }