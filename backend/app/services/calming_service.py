from app.services.llm_service import ask_llm

CALMING_SYSTEM_PROMPT = """
You are a gentle, caring AI companion for someone with dementia.
Your ONLY job right now is to calm and reassure them.
Keep your response SHORT (2-3 sentences max).
Speak slowly and simply. Be warm, never clinical.
Always remind them they are safe and not alone.
Never mention dementia or memory loss.
"""

TRIGGER_WORDS = ["scared", "lost", "confused", "don't know", "where am i", 
                  "help me", "afraid", "worried", "don't understand", "panic"]

def is_calming_trigger(text: str) -> bool:
    """Check if the user's message contains distress trigger words."""
    text_lower = text.lower()
    return any(trigger in text_lower for trigger in TRIGGER_WORDS)

def get_calming_response(user_message: str) -> str:
    """Generate a calming, reassuring response."""
    return ask_llm(
        system_prompt=CALMING_SYSTEM_PROMPT,
        user_message=user_message
    )