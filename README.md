# memoria-ai

Memoria AI is a FastAPI backend plus React frontend for a dementia-support assistant.

## Voice Setup

The active patient voice flow now uses:

- Browser Web Speech API for speech-to-text
- ElevenLabs for text-to-speech

You need to add these keys in `backend/.env`:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`

Copy `backend/.env.example` if you want a template.