# Memoria Frontend

This is a React + Vite frontend for the Memoria AI backend.

## What It Includes

- Patient view with large quick-action buttons and voice-first interaction
- Single patient API entrypoint via POST /chat/
- Intent-aware detail cards for routine, calendar, and location responses
- Caregiver dashboard for task CRUD via /caregiver/tasks endpoints
- Voice In using browser speech recognition
- Voice Out using ElevenLabs through the backend
- Voice-only patient flow, with no typed text box in the patient view

## Current Voice Mode

- Voice In: browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- Voice Out: backend ElevenLabs endpoint (`POST /voice/speak`)
- This means you only need ElevenLabs credits for the active voice flow.

## Voice Tech Stack

- Frontend captures speech with browser speech recognition
- Backend handles chat intent and response generation as usual
- Backend generates speech with ElevenLabs
- Frontend plays the returned MP3 response

## Accounts You Need

You need to sign up for:

1. ElevenLabs, for natural voice output.

Then add the keys to `backend/.env`:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`

You can copy the template from `backend/.env.example`.

## Voice Flow

1. Patient clicks `Voice In` in the chat panel.
2. Browser listens and transcribes speech.
3. Transcript text is sent to `POST /chat/`.
4. Backend processes intent through the existing LangGraph pipeline.
5. Frontend requests speech audio from `POST /voice/speak`.
6. Backend generates ElevenLabs audio for the response.
7. Frontend shows the response in chat and plays the audio.
8. The patient view does not expose a text entry box; it is voice-first only.

## Voice Quality Notes

- The actual voice comes from ElevenLabs, so it is much more natural than browser speech synthesis.
- The specific voice depends on the ElevenLabs voice ID you configure.
- If you want a more feminine voice, choose a female ElevenLabs voice and paste its voice ID into `backend/.env`.

## Browser Support Notes

- Best support: latest Chrome or Edge.
- Microphone access requires permission.
- When unsupported, the patient voice flow will not work, but caregiver mode still works.

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
