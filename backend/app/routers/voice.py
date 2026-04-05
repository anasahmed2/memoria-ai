from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.services.graph_service import process_message
from app.services.voice_service import (
    encode_audio_base64,
    synthesize_speech,
    transcribe_audio_bytes,
)


router = APIRouter(prefix="/voice", tags=["Voice"])


class SpeakRequest(BaseModel):
    text: str


@router.post("/chat")
async def voice_chat(request: Request):
    """Accept raw recorded audio, transcribe it, answer it, and return spoken audio."""
    content_type = request.headers.get("content-type", "audio/webm")
    audio_bytes = await request.body()
    transcript = transcribe_audio_bytes(audio_bytes, filename=f"voice.{content_type.split('/')[-1].split(';')[0]}")

    chat_result = process_message(transcript)
    spoken_audio = synthesize_speech(chat_result["response"])

    return {
        "transcript": transcript,
        "intent": chat_result["intent"],
        "response": chat_result["response"],
        "data": chat_result["data"],
        "audio_base64": encode_audio_base64(spoken_audio),
        "audio_mime": "audio/mpeg",
    }


@router.post("/speak")
def voice_speak(request: SpeakRequest):
    """Convert response text to spoken ElevenLabs audio."""
    spoken_audio = synthesize_speech(request.text)
    return {
        "audio_base64": encode_audio_base64(spoken_audio),
        "audio_mime": "audio/mpeg",
    }