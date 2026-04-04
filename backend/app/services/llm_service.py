import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# OpenRouter uses the OpenAI SDK but with a different base URL
client = OpenAI(
    api_key=os.getenv("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1"
)

def ask_llm(system_prompt: str, user_message: str, model: str = "mistralai/mixtral-8x7b-instruct") -> str:
    """Send a prompt to the LLM and get a response."""
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        max_tokens=300,
        temperature=0.7
    )
    return response.choices[0].message.content