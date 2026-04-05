from typing import TypedDict
from langgraph.graph import StateGraph, END
from app.services.intent_service import classify_intent
from app.services.memory_service import recall_person
from app.services.calming_service import get_calming_response
from app.services.routine_service import get_routine_response
from app.services.location_service import get_location_response
from app.services.llm_service import ask_llm
from app.services.task_service import get_task_response


# --- State Definition ---
# This is the data that flows through the entire graph
class ChatState(TypedDict):
    message: str        # original user message
    intent: str         # classified intent
    response: str       # final response to return
    raw_data: dict      # any extra data (steps, location, etc.)

# --- Node Functions ---

def intent_node(state: ChatState) -> ChatState:
    """Node 1: Classify what the user wants."""
    intent = classify_intent(state["message"])
    print(f"🧠 Intent detected: {intent}")
    return {**state, "intent": intent}

def memory_node(state: ChatState) -> ChatState:
    """Node 2a: Handle memory recall."""
    result = recall_person(state["message"])
    return {**state, "response": result["response"], "raw_data": {"raw": result["raw"]}}

def calming_node(state: ChatState) -> ChatState:
    """Node 2b: Handle calming/distress."""
    response = get_calming_response(state["message"])
    return {**state, "response": response, "raw_data": {}}

def routine_node(state: ChatState) -> ChatState:
    """Node 2c: Handle routine questions."""
    result = get_routine_response(state["message"])
    return {
        **state,
        "response": result["response"],
        "raw_data": {
            "period": result["period"],
            "current_time": result["current_time"],
            "steps": result["steps"]
        }
    }

def location_node(state: ChatState) -> ChatState:
    """Node 2d: Handle location questions."""
    result = get_location_response(state["message"])
    return {
        **state,
        "response": result["response"],
        "raw_data": {"location": result["location"], "safe": result["safe"]}
    }

def general_node(state: ChatState) -> ChatState:
    """Node 2e: Handle general conversation."""
    response = ask_llm(
        system_prompt=(
            "You are a warm, gentle AI companion for someone with dementia. "
            "Respond kindly and simply in 2-3 sentences. "
            "Never mention dementia or memory loss."
        ),
        user_message=state["message"]
    )
    return {**state, "response": response, "raw_data": {}}

def route_intent(state: ChatState) -> str:
    """Router: Direct to the right node based on intent."""
    routes = {
        "memory_recall": "memory",
        "calming": "calming",
        "routine": "routine",
        "location": "location",
        "general": "general"
    }
    return routes.get(state["intent"], "general")

def calendar_node(state: ChatState) -> ChatState:
    result = get_task_response(state["message"])
    return {
        **state,
        "response": result["response"],
        "raw_data": {
            "current_tasks": result["current_tasks"],
            "upcoming_tasks": result["upcoming_tasks"]
        }
    }

# --- Build the Graph ---

def build_graph():
    graph = StateGraph(ChatState)

    # Add all nodes
    graph.add_node("intent", intent_node)
    graph.add_node("memory", memory_node)
    graph.add_node("calming", calming_node)
    graph.add_node("routine", routine_node)
    graph.add_node("location", location_node)
    graph.add_node("general", general_node)
    graph.add_node("calendar", calendar_node)
    # Entry point
    graph.set_entry_point("intent")

    # Conditional routing after intent classification
    graph.add_conditional_edges(
        "intent",
        route_intent,
        {
            "memory": "memory",
            "calming": "calming",
            "routine": "routine",
            "location": "location",
            "general": "general",
            "calendar": "calendar"
        }
    )

    # All feature nodes lead to END
    graph.add_edge("memory", END)
    graph.add_edge("calming", END)
    graph.add_edge("routine", END)
    graph.add_edge("location", END)
    graph.add_edge("general", END)
    graph.add_edge("calendar", END)

    return graph.compile()

# Compile once at startup
memoria_graph = build_graph()

def process_message(message: str) -> dict:
    """Main entry point — run any message through the full graph."""
    initial_state: ChatState = {
        "message": message,
        "intent": "",
        "response": "",
        "raw_data": {}
    }
    result = memoria_graph.invoke(initial_state)
    return {
        "message": message,
        "intent": result["intent"],
        "response": result["response"],
        "data": result["raw_data"]
    }