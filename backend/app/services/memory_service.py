import json
import os
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document

PEOPLE_PATH = "data/people.json"
FAISS_INDEX_PATH = "data/memory_store/faiss_index"

embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

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
        docs.append(Document(page_content=content, metadata={"name": person["name"]}))
    vectorstore = FAISS.from_documents(docs, embeddings)
    os.makedirs(FAISS_INDEX_PATH, exist_ok=True)
    vectorstore.save_local(FAISS_INDEX_PATH)
    print("✅ FAISS index built and saved.")
    return vectorstore

def load_index():
    if os.path.exists(FAISS_INDEX_PATH):
        return FAISS.load_local(FAISS_INDEX_PATH, embeddings, allow_dangerous_deserialization=True)
    return build_index()

def recall_person(query: str) -> str:
    vectorstore = load_index()
    results = vectorstore.similarity_search(query, k=1)
    if not results:
        return "I don't have any information about that person."
    return results[0].page_content