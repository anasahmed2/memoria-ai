from app.services.llm_service import ask_llm

INTENT_SYSTEM_PROMPT = """
You are an intent classifier for a dementia care AI assistant.
Classify the user's message into EXACTLY one of these intents:
- memory_recall     → asking about a person (who is X, tell me about X)
- routine           → asking what to do, what time it is, daily schedule
- calming           → expressing fear, confusion, being lost or scared
- location          → asking where they are
- general           → anything else

Reply with ONLY the intent label, nothing else.
Examples:
"Who is Sarah?" → memory_recall
"I'm scared" → calming
"What should I do now?" → routine
"Where am I?" → location
"Thank you" → general
"""

VALID_INTENTS = ["memory_recall", "routine", "calming", "location", "general"]

def classify_intent(message: str) -> str:
    """Classify the user's message into an intent."""
    result = ask_llm(
        system_prompt=INTENT_SYSTEM_PROMPT,
        user_message=message
    )
    # Clean up and validate the response
    intent = result.strip().lower()
    if intent not in VALID_INTENTS:
        return "general"
    return intent