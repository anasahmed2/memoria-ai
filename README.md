# Memoria AI

Memoria AI is a voice-first care assistant built with a FastAPI backend and a React frontend.
It is designed for calm, simple patient interactions and caregiver task management.

## What The App Does

- Patient can ask for:
	- routine guidance
	- tasks and reminders
	- memory recall about known people
	- calming support
	- current location
	- current weather and dress guidance
- Caregiver can:
	- create tasks
	- mark tasks complete
	- delete tasks
	- view all tasks
- Voice flow:
	- voice in via browser speech recognition
	- voice out via ElevenLabs

## Tech Stack

### Frontend

- React (Vite)
- JavaScript + CSS
- Browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) for voice input
- Browser Geolocation API (`navigator.geolocation`) for GPS coordinates

### Backend

- FastAPI
- LangGraph for intent-based routing/workflows
- OpenAI SDK targeting OpenRouter for LLM completions
- FAISS + sentence-transformers embeddings for memory recall retrieval

### External APIs

- OpenRouter (LLM via `OPENROUTER_API_KEY`)
- ElevenLabs (TTS voice out)
- OpenStreetMap Nominatim (reverse geocoding from GPS)
- Open-Meteo (free weather API)

## High-Level System Design

### Core Flow

1. Frontend sends patient message to `POST /chat/`.
2. Backend classifies message intent (`memory_recall`, `routine`, `calming`, `location`, `calendar`, `weather`, `general`).
3. LangGraph routes to the corresponding service node.
4. Service returns:
	 - natural-language response text
	 - structured payload (`data`) for UI cards
5. Frontend displays response in conversation.
6. Frontend requests `POST /voice/speak` and plays ElevenLabs audio.

### GPS + Weather/Location Context Flow

When the patient asks weather/location-style questions:

1. Frontend requests browser GPS coordinates.
2. Frontend sends coordinates to `POST /location/context`.
3. Backend uses:
	 - Nominatim reverse geocoding for place name
	 - Open-Meteo for current weather
4. Frontend sends this context with the chat message to `POST /chat/`.
5. Weather/location nodes return context-aware answers (city + temperature + clothing hint).

## Project Structure

```text
backend/
	app/
		routers/
			chat.py
			location.py
			tasks.py
			voice.py
			memory.py
			routine.py
			calming.py
		services/
			graph_service.py
			intent_service.py
			memory_service.py
			routine_service.py
			task_service.py
			location_service.py
			weather_service.py
			calming_service.py
			llm_service.py
			voice_service.py
	data/
		people.json
		tasks.json
		routines.json
		memory_store/faiss_index/

frontend/
	src/
		App.jsx
		App.css
		api.js
```

## API Endpoints

### Chat And Context

- `POST /chat/`
	- Request: `{ "message": string, "context"?: object }`
	- Response: `{ message, intent, response, data }`

- `POST /location/context`
	- Request: `{ "latitude": number, "longitude": number }`
	- Response: location + weather context payload

### Voice

- `POST /voice/speak`
	- Request: `{ "text": string }`
	- Response: base64 audio payload for playback

### Tasks (Caregiver)

- `GET /caregiver/tasks`
- `POST /caregiver/tasks`
- `PATCH /caregiver/tasks/{task_id}/complete`
- `DELETE /caregiver/tasks/{task_id}`

### Health

- `GET /health`

## Environment Variables

Create `backend/.env` (you can copy from `backend/.env.example`):

- `OPENROUTER_API_KEY` (required)
- `ELEVENLABS_API_KEY` (required for voice out)
- `ELEVENLABS_VOICE_ID` (required for voice out)

Optional voice settings:

- `ELEVENLABS_MODEL_ID`
- `ELEVENLABS_OUTPUT_FORMAT`

## Local Setup

### Backend

```powershell
cd backend
..\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open the frontend URL shown by Vite (usually `http://localhost:5173`).

## Patient Prompt Catalog

Use short, direct prompts for best intent matching.

### Routine

- What should I do now?
- What should I do this morning?
- What is my routine right now?
- What do I do next?

### Calendar / Tasks

- What do I have today?
- Do I have any appointments?
- What is on my schedule?
- What is my next task?
- Did I take my medication?

### Memory Recall

- Who is Sarah?
- Tell me about Michael.
- Who is Dr. Patel?
- Do you remember Madison?

### Location

- Where am I?
- Where am I right now?
- What city am I in?
- What is my current location?

### Weather

- What is the weather?
- What is the weather right now?
- Is it raining outside?
- Is it cold outside?
- Do I need a jacket today?
- Should I dress warm if I go outside?

### Calming

- I am scared.
- I feel confused.
- I feel lost.
- Please help me calm down.

### General

- Thank you.
- Can you help me?
- Hi.

## Notes

- Browser microphone and location permissions must be allowed for full voice/location features.
- Voice out depends on ElevenLabs account status and quota.
- Weather/location external APIs are free and do not require API keys in this setup.