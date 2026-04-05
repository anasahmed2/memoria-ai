# Memoria Frontend

This is a React + Vite frontend for the Memoria AI backend.

## What It Includes

- Patient view with large quick-action buttons and simple chat
- Single patient API entrypoint via POST /chat/
- Intent-aware detail cards for routine, calendar, and location responses
- Caregiver dashboard for task CRUD via /caregiver/tasks endpoints
- Voice In (speech-to-text) for patient questions
- Voice Out (text-to-speech) for assistant replies
- Voice-only patient flow, with no typed text box in the patient view

## Voice Tech Stack

- Browser Web Speech API for Voice In:
	- `SpeechRecognition` / `webkitSpeechRecognition`
- Browser Speech Synthesis API for Voice Out:
	- `speechSynthesis` + `SpeechSynthesisUtterance`
- No extra npm package needed for voice features

## Voice Flow

1. Patient clicks `Voice In` in the chat panel.
2. Browser listens and transcribes speech.
3. Final transcript is sent to `POST /chat/`.
4. Backend returns the existing generated response.
5. Frontend renders the response and reads it aloud if `Voice Out` is enabled.
6. The patient view does not expose a text entry box; it is voice-first only.

## Voice Quality Notes

- The app prefers a more natural English voice when the browser exposes one.
- If multiple voices are available, you can manually select one from the Voice dropdown.
- The browser controls the actual voice list, so the exact female voice depends on the device and installed voices.

## Browser Support Notes

- Best support: latest Chrome or Edge.
- Some browsers (especially iOS Safari) may have partial support for speech recognition.
- When unsupported, chat still works in normal text mode.

## Backend APIs Used

- POST /chat/
- GET /caregiver/tasks
- POST /caregiver/tasks
- PATCH /caregiver/tasks/{task_id}/complete
- DELETE /caregiver/tasks/{task_id}

## Local Setup

1. Install frontend dependencies:
	npm install

2. Configure API URL:
	copy .env.example to .env and set VITE_API_BASE_URL if needed

3. Start frontend:
	npm run dev

4. Build for production:
	npm run build

## Notes

- Default API base URL is http://127.0.0.1:8000.
- Backend CORS is currently open, so local frontend can connect directly.
