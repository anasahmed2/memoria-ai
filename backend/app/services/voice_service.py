import base64
import io
import os

import requests
from fastapi import HTTPException
from openai import OpenAI


OPENAI_WHISPER_MODEL = os.getenv("OPENAI_WHISPER_MODEL", "whisper-1")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")
ELEVENLABS_MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
ELEVENLABS_OUTPUT_FORMAT = os.getenv("ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128")


def _get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail=(
                "OPENAI_API_KEY is not configured. Create an OpenAI account and add the key to backend/.env."
            ),
        )

    return OpenAI(api_key=api_key)


def transcribe_audio_bytes(audio_bytes: bytes, filename: str = "voice.webm") -> str:
    """Transcribe recorded audio using OpenAI Whisper."""
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="No audio was received.")

    client = _get_openai_client()
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename

    try:
      response = client.audio.transcriptions.create(
          model=OPENAI_WHISPER_MODEL,
          file=audio_file,
      )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Whisper transcription failed: {exc}") from exc

    transcript = (response.text or "").strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Could not understand the audio.")
    return transcript


def synthesize_speech(text: str) -> bytes:
    """Synthesize assistant speech using ElevenLabs."""
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail=(
                "ELEVENLABS_API_KEY is not configured. Create an ElevenLabs account and add the key to backend/.env."
            ),
        )

    if not ELEVENLABS_VOICE_ID:
        raise HTTPException(
            status_code=500,
            detail=(
                "ELEVENLABS_VOICE_ID is not configured. Pick a voice in ElevenLabs and add its voice ID to backend/.env."
            ),
        )

    payload = {
        "text": text,
        "model_id": ELEVENLABS_MODEL_ID,
        "voice_settings": {
            "stability": 0.35,
            "similarity_boost": 0.9,
            "style": 0.4,
            "use_speaker_boost": True,
        },
    }

    url = (
        f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
        f"?output_format={ELEVENLABS_OUTPUT_FORMAT}"
    )
    headers = {
        "xi-api-key": api_key,
        "accept": "audio/mpeg",
        "content-type": "application/json",
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=90)
    except requests.RequestException as exc:
        raise HTTPException(status_code=500, detail=f"ElevenLabs request failed: {exc}") from exc

    if not response.ok:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"ElevenLabs TTS failed: {response.text}",
        )

    return response.content


def encode_audio_base64(audio_bytes: bytes) -> str:
    return base64.b64encode(audio_bytes).decode("utf-8")