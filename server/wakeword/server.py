"""openWakeWord WebSocket server.

Receives 16kHz 16-bit mono PCM frames (1280 samples = 2560 bytes) over WebSocket,
runs wake word detection, and sends JSON detection events back.

Based on openWakeWord's examples/web/streaming_server.py.
"""

import asyncio
import json
import os
import time

import numpy as np
from aiohttp import web
import openwakeword
from openwakeword.model import Model

WAKEWORD_PORT = int(os.environ.get("WAKEWORD_PORT", "9000"))
WAKEWORD_MODEL = os.environ.get("WAKEWORD_MODEL", "hey_jarvis")
WAKEWORD_THRESHOLD = float(os.environ.get("WAKEWORD_THRESHOLD", "0.5"))

# Cooldown after detection to avoid re-triggers (seconds)
DETECTION_COOLDOWN = 2.0


async def websocket_handler(request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    # Download default models if needed, then load
    openwakeword.utils.download_models()
    oww_model = Model(
        wakeword_models=[WAKEWORD_MODEL],
        inference_framework="onnx",
    )

    last_detection = 0.0

    async for msg in ws:
        if msg.type == web.WSMsgType.BINARY:
            # Expect 1280 int16 samples = 2560 bytes
            audio = np.frombuffer(msg.data, dtype=np.int16)
            oww_model.predict(audio)

            for model_name in oww_model.prediction_buffer:
                scores = oww_model.prediction_buffer[model_name]
                if len(scores) > 0 and scores[-1] > WAKEWORD_THRESHOLD:
                    now = time.monotonic()
                    if now - last_detection > DETECTION_COOLDOWN:
                        last_detection = now
                        await ws.send_str(
                            json.dumps(
                                {"detected": model_name, "score": round(float(scores[-1]), 3)}
                            )
                        )
                        # Reset buffer to avoid repeated triggers
                        oww_model.prediction_buffer[model_name] = []

        elif msg.type == web.WSMsgType.ERROR:
            break

    return ws


async def health_handler(_request: web.Request) -> web.Response:
    return web.Response(text="ok")


def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/ws", websocket_handler)
    app.router.add_get("/health", health_handler)
    return app


if __name__ == "__main__":
    print(f"[wakeword] Starting on port {WAKEWORD_PORT} (model={WAKEWORD_MODEL}, threshold={WAKEWORD_THRESHOLD})")
    web.run_app(create_app(), port=WAKEWORD_PORT)
