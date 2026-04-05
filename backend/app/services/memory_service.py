import json
import os
from pathlib import Path
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document
from app.services.llm_service import ask_llm

PEOPLE_PATH = "data/people.json"
FAISS_INDEX_PATH = "data/memory_store/faiss_index"
BASE_DIR = Path(__file__).resolve().parents[2]
PHOTOS_BASE_URL = "/photos"

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

MEMORY_SYSTEM_PROMPT = """
You are a gentle AI assistant helping someone with dementia remember people in their life.
You will be given raw memory data about a person.
Convert it into a warm, simple, spoken response (2-3 sentences max).
Speak directly to the user as if talking to them — use "your" not "the user's".
Keep it simple, warm and reassuring. Never mention dementia or memory loss.
Example: "Sarah is your daughter. She visits you often and has two kids named Lily and Tom."
"""

def build_index():
    with open(PEOPLE_PATH, "r") as f:
        people = json.load(f)
    docs = []
    for person in people:
        content = (
            f"Name: {person['name']}\n"
            f"Relationship: {person['relationship']}\n"
            f"Notes: {person['notes']}"
        )
        docs.append(
            Document(
                page_content=content,
                metadata={
                    "name": person["name"],
                    "relationship": person.get("relationship"),
                    "notes": person.get("notes"),
                    "image": person.get("image"),
                },
            )
        )
    vectorstore = FAISS.from_documents(docs, embeddings)
    os.makedirs(FAISS_INDEX_PATH, exist_ok=True)
    vectorstore.save_local(FAISS_INDEX_PATH)
    print("✅ FAISS index built and saved.")
    return vectorstore

def load_index():
    if os.path.exists(FAISS_INDEX_PATH):
        return FAISS.load_local(FAISS_INDEX_PATH, embeddings, allow_dangerous_deserialization=True)
    return build_index()


def load_people():
    people_path = BASE_DIR / PEOPLE_PATH
    with open(people_path, "r", encoding="utf-8") as file:
        return json.load(file)


def find_person(person_name: str) -> dict | None:
    for person in load_people():
        if person.get("name", "").lower() == person_name.lower():
            return person
    return None

def recall_person(query: str) -> dict:
    vectorstore = load_index()
    results = vectorstore.similarity_search(query, k=1)

    if not results:
        return {
            "raw": None,
            "response": "I'm sorry, I don't have any information about that person."
        }

    raw_data = results[0].page_content
    metadata = results[0].metadata or {}
    person = find_person(metadata.get("name", "")) or metadata
    image_name = person.get("image")

    # Convert raw memory data into a natural spoken response
    natural_response = ask_llm(
        system_prompt=MEMORY_SYSTEM_PROMPT,
        user_message=f"The user asked: '{query}'\n\nMemory data:\n{raw_data}"
    )

    return {
        "raw": raw_data,
        "response": natural_response,
        "person": {
            "name": person.get("name"),
            "relationship": person.get("relationship"),
            "notes": person.get("notes"),
            "image": image_name,
            "image_url": f"{PHOTOS_BASE_URL}/{image_name}" if image_name else None,
        },
    }