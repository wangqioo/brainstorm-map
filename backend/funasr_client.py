"""
ASR client - supports two backends:
  1. whisper.cpp server (default, already running on SPARK2:8082)
  2. FunASR WebSocket server (when available on :10095)

Set ASR_BACKEND=funasr to switch to FunASR once it's deployed.
"""
import asyncio
import io
import json
import os
import wave
import aiohttp
import websockets

# ─── Config ────────────────────────────────────────────────────────────────────

ASR_BACKEND  = os.getenv("ASR_BACKEND",  "whisper")   # whisper | funasr
WHISPER_HOST = os.getenv("WHISPER_HOST", "localhost")
WHISPER_PORT = int(os.getenv("WHISPER_PORT", "8082"))
FUNASR_HOST  = os.getenv("FUNASR_HOST",  "localhost")
FUNASR_PORT  = int(os.getenv("FUNASR_PORT",  "10095"))
FUNASR_MODE  = os.getenv("FUNASR_MODE",  "offline")

# ─── WAV helper ────────────────────────────────────────────────────────────────

def pcm16_to_wav(pcm_bytes: bytes, sample_rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    return buf.getvalue()


def _is_wav(data: bytes) -> bool:
    return len(data) > 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE"

# ─── Whisper.cpp backend ───────────────────────────────────────────────────────

async def _transcribe_whisper(audio_bytes: bytes, wav_format: str) -> str:
    if wav_format == "pcm" or not _is_wav(audio_bytes):
        audio_bytes = pcm16_to_wav(audio_bytes)

    url = f"http://{WHISPER_HOST}:{WHISPER_PORT}/inference"
    form = aiohttp.FormData()
    form.add_field("file", audio_bytes,
                   filename="recording.wav",
                   content_type="audio/wav")
    form.add_field("temperature", "0.0")
    form.add_field("response_format", "json")
    form.add_field("language", "zh")

    try:
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=60)
        ) as session:
            async with session.post(url, data=form) as resp:
                if resp.status == 200:
                    data = await resp.json(content_type=None)
                    return (data.get("text") or "").strip()
                print(f"[Whisper] HTTP {resp.status}")
    except Exception as e:
        print(f"[Whisper] Error: {e}")
    return ""

# ─── FunASR WebSocket backend ──────────────────────────────────────────────────

async def _transcribe_funasr(audio_bytes: bytes, wav_format: str) -> str:
    if _is_wav(audio_bytes):
        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                audio_bytes = wf.readframes(wf.getnframes())
                wav_format = "pcm"
        except Exception:
            pass

    uri = f"ws://{FUNASR_HOST}:{FUNASR_PORT}"
    transcript = ""

    try:
        async with websockets.connect(uri, ping_interval=None, close_timeout=10) as ws:
            await ws.send(json.dumps({
                "mode": FUNASR_MODE, "wav_name": "stream",
                "wav_format": wav_format, "is_speaking": True,
                "chunk_size": [5, 10, 5], "audio_fs": 16000,
                "itn": True, "language": "zh"
            }))
            for i in range(0, len(audio_bytes), 9600):
                await ws.send(audio_bytes[i:i + 9600])
                await asyncio.sleep(0)
            await ws.send(json.dumps({"is_speaking": False}))

            deadline = asyncio.get_event_loop().time() + 30
            while asyncio.get_event_loop().time() < deadline:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    data = json.loads(msg)
                    if "text" in data:
                        if data.get("mode") in ("2pass-offline", "offline"):
                            transcript = data["text"]
                        else:
                            transcript += data.get("text", "")
                    if data.get("is_final") or data.get("mode") in ("2pass-offline", "offline"):
                        break
                except asyncio.TimeoutError:
                    break
    except ConnectionRefusedError:
        print(f"[FunASR] Connection refused at {uri}")
    except Exception as e:
        print(f"[FunASR] Error: {e}")
    return transcript.strip()

# ─── Public API ───────────────────────────────────────────────────────────────

async def transcribe(audio_bytes: bytes, wav_format: str = "pcm") -> str:
    if ASR_BACKEND == "funasr":
        result = await _transcribe_funasr(audio_bytes, wav_format)
        if not result:
            result = await _transcribe_whisper(audio_bytes, wav_format)
    else:
        result = await _transcribe_whisper(audio_bytes, wav_format)
        if not result:
            result = await _transcribe_funasr(audio_bytes, wav_format)
    return result


async def check_funasr() -> dict:
    try:
        async with websockets.connect(
            f"ws://{FUNASR_HOST}:{FUNASR_PORT}",
            ping_interval=None, open_timeout=2
        ) as ws:
            return {"online": True, "backend": "funasr"}
    except Exception:
        pass
    try:
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=2)
        ) as session:
            async with session.get(
                f"http://{WHISPER_HOST}:{WHISPER_PORT}/health"
            ) as resp:
                if resp.status == 200:
                    return {"online": True, "backend": f"whisper@{WHISPER_HOST}:{WHISPER_PORT}"}
    except Exception:
        pass
    return {"online": False, "backend": ASR_BACKEND}
