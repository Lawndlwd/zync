"""Whisper transcription microservice.

Accepts audio uploads via POST /transcribe, returns JSON { "text": "..." }.
Uses faster-whisper (CTranslate2) for efficient CPU inference.
"""

import os
import tempfile
import subprocess
import asyncio
from pathlib import Path

from aiohttp import web
from faster_whisper import WhisperModel

HOST = os.environ.get("WHISPER_HOST", "0.0.0.0")
PORT = int(os.environ.get("WHISPER_PORT", "9100"))
MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base.en")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB

model: WhisperModel | None = None


def get_model() -> WhisperModel:
    global model
    if model is None:
        model = WhisperModel(MODEL_SIZE, device="cpu", compute_type=COMPUTE_TYPE)
    return model


async def convert_to_wav(input_path: str, output_path: str) -> None:
    """Convert audio to 16kHz mono WAV using ffmpeg."""
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-i", input_path, "-ar", "16000", "-ac", "1", "-y", output_path,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await asyncio.wait_for(proc.wait(), timeout=30)
    if proc.returncode != 0:
        raise RuntimeError("ffmpeg conversion failed")


async def handle_transcribe(request: web.Request) -> web.Response:
    """Handle POST /transcribe with multipart audio upload."""
    reader = await request.multipart()
    audio_data = None
    audio_format = "ogg"

    while True:
        part = await reader.next()
        if part is None:
            break
        if part.name == "audio":
            audio_data = await part.read(decode=False)
        elif part.name == "format":
            audio_format = (await part.text()).strip() or "ogg"

    if not audio_data:
        return web.json_response({"error": "No audio file provided"}, status=400)

    if len(audio_data) > MAX_FILE_SIZE:
        return web.json_response({"error": "File too large"}, status=413)

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, f"input.{audio_format}")
        wav_path = os.path.join(tmpdir, "input.wav")

        with open(input_path, "wb") as f:
            f.write(audio_data)

        # Convert to WAV
        try:
            await convert_to_wav(input_path, wav_path)
        except Exception:
            return web.json_response({"error": "Audio conversion failed"}, status=422)

        # Transcribe
        try:
            whisper = get_model()
            segments, _ = whisper.transcribe(wav_path, beam_size=1, language="en")
            text = " ".join(seg.text.strip() for seg in segments).strip()
        except Exception as e:
            return web.json_response({"error": f"Transcription failed: {e}"}, status=500)

    return web.json_response({"text": text})


async def handle_health(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok"})


app = web.Application(client_max_size=MAX_FILE_SIZE + 1024)
app.router.add_post("/transcribe", handle_transcribe)
app.router.add_get("/health", handle_health)

if __name__ == "__main__":
    print(f"Whisper service starting on {HOST}:{PORT} (model={MODEL_SIZE}, compute={COMPUTE_TYPE})")
    # Warm up model on startup
    get_model()
    print("Model loaded, ready to serve")
    web.run_app(app, host=HOST, port=PORT)
