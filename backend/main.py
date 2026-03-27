"""
BrainMap - Backend API Server
FastAPI + WebSocket + vLLM (SPARK1) + FunASR (SPARK2) + SQLite
"""
import asyncio
import json
import os
from typing import Optional, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

import database as db
import llm_client as llm
import funasr_client as funasr

# ─── Config ────────────────────────────────────────────────────────────────────

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

app = FastAPI(title="BrainMap API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── WebSocket Manager ─────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()

# ─── Request Models ─────────────────────────────────────────────────────────────

class InputRequest(BaseModel):
    text: str
    model: Optional[str] = None

class NodePositionUpdate(BaseModel):
    x: float
    y: float

class ManualNodeCreate(BaseModel):
    id: Optional[str] = None
    label: str
    type: str = "idea"
    description: str = ""
    category: str = ""

class ManualEdgeCreate(BaseModel):
    source: str
    target: str
    label: str = ""

# ─── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    vllm_status, funasr_status = await asyncio.gather(
        llm.check_vllm(),
        funasr.check_funasr()
    )
    return {
        "status": "ok",
        "vllm": vllm_status,
        "funasr": funasr_status,
        "vllm_model": llm.VLLM_MODEL,
        "funasr_host": f"{funasr.FUNASR_HOST}:{funasr.FUNASR_PORT}"
    }


@app.get("/api/mindmap")
async def get_mindmap():
    return db.get_mindmap()


@app.post("/api/input")
async def process_input(req: InputRequest):
    """
    Process user text → LLM extracts concepts → update mind map → broadcast.
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Empty input")

    await manager.broadcast({"type": "processing", "text": req.text[:80]})

    existing_graph = db.get_mindmap()
    updates = await llm.process_input(req.text, existing_graph, req.model)
    new_graph = db.apply_updates(updates)
    db.add_history(req.text, updates.get("summary", ""))

    await manager.broadcast({
        "type": "update",
        "graph": new_graph,
        "summary": updates.get("summary", ""),
        "diff": {
            "added_nodes": len(updates.get("additions", {}).get("nodes", [])),
            "added_edges": len(updates.get("additions", {}).get("edges", [])),
            "removed_nodes": len(updates.get("removals", {}).get("node_ids", [])),
        }
    })

    return {"ok": True, "summary": updates.get("summary", ""), "graph": new_graph}


@app.post("/api/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    format: str = Form("pcm")
):
    """
    Receive audio file from browser, proxy to FunASR on SPARK2,
    return transcript text.

    Frontend should send:
    - PCM 16kHz mono 16-bit (ideal), or
    - WAV file
    """
    audio_bytes = await audio.read()

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio")

    transcript = await funasr.transcribe(audio_bytes, wav_format=format)

    if not transcript:
        raise HTTPException(status_code=422, detail="No speech detected")

    return {"transcript": transcript}


@app.post("/api/voice-input")
async def voice_input(
    audio: UploadFile = File(...),
    format: str = Form("pcm"),
    model: Optional[str] = Form(None)
):
    """
    Combined endpoint: transcribe audio → process with LLM → update mind map.
    One-shot voice-to-mindmap pipeline.
    """
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio")

    await manager.broadcast({"type": "processing", "text": "正在识别语音..."})

    transcript = await funasr.transcribe(audio_bytes, wav_format=format)
    if not transcript:
        await manager.broadcast({"type": "error", "text": "语音识别失败"})
        raise HTTPException(status_code=422, detail="No speech detected")

    await manager.broadcast({"type": "processing", "text": f"识别: {transcript[:40]}..."})

    existing_graph = db.get_mindmap()
    updates = await llm.process_input(transcript, existing_graph, model)
    new_graph = db.apply_updates(updates)
    db.add_history(transcript, updates.get("summary", ""))

    await manager.broadcast({
        "type": "update",
        "graph": new_graph,
        "summary": updates.get("summary", ""),
        "transcript": transcript,
        "diff": {
            "added_nodes": len(updates.get("additions", {}).get("nodes", [])),
            "added_edges": len(updates.get("additions", {}).get("edges", [])),
            "removed_nodes": len(updates.get("removals", {}).get("node_ids", [])),
        }
    })

    return {
        "ok": True,
        "transcript": transcript,
        "summary": updates.get("summary", ""),
        "graph": new_graph
    }


@app.get("/api/history")
async def get_history(limit: int = 30):
    return db.get_history(limit)


@app.delete("/api/mindmap")
async def clear_mindmap():
    db.clear_mindmap()
    graph = db.get_mindmap()
    await manager.broadcast({"type": "update", "graph": graph, "summary": "已清空思维导图"})
    return {"ok": True}


@app.put("/api/nodes/{node_id}/position")
async def update_position(node_id: str, body: NodePositionUpdate):
    db.update_node_position(node_id, body.x, body.y)
    return {"ok": True}


@app.post("/api/nodes")
async def create_node(node: ManualNodeCreate):
    import uuid
    node_id = node.id or str(uuid.uuid4())[:8]
    updates = {
        "additions": {
            "nodes": [{"id": node_id, "label": node.label, "type": node.type,
                       "description": node.description, "category": node.category}],
            "edges": []
        },
        "removals": {"node_ids": [], "edge_ids": []},
        "updates": {"nodes": []}
    }
    new_graph = db.apply_updates(updates)
    await manager.broadcast({"type": "update", "graph": new_graph, "summary": f"添加节点: {node.label}"})
    return {"ok": True, "id": node_id}


@app.delete("/api/nodes/{node_id}")
async def delete_node(node_id: str):
    updates = {
        "additions": {"nodes": [], "edges": []},
        "removals": {"node_ids": [node_id], "edge_ids": []},
        "updates": {"nodes": []}
    }
    new_graph = db.apply_updates(updates)
    await manager.broadcast({"type": "update", "graph": new_graph, "summary": f"删除节点 {node_id}"})
    return {"ok": True}


@app.post("/api/edges")
async def create_edge(edge: ManualEdgeCreate):
    import uuid
    edge_id = f"e-{edge.source}-{edge.target}-{str(uuid.uuid4())[:4]}"
    updates = {
        "additions": {
            "nodes": [],
            "edges": [{"id": edge_id, "source": edge.source,
                       "target": edge.target, "label": edge.label}]
        },
        "removals": {"node_ids": [], "edge_ids": []},
        "updates": {"nodes": []}
    }
    new_graph = db.apply_updates(updates)
    await manager.broadcast({"type": "update", "graph": new_graph, "summary": "添加连接"})
    return {"ok": True}


@app.delete("/api/edges/{edge_id}")
async def delete_edge(edge_id: str):
    updates = {
        "additions": {"nodes": [], "edges": []},
        "removals": {"node_ids": [], "edge_ids": [edge_id]},
        "updates": {"nodes": []}
    }
    new_graph = db.apply_updates(updates)
    await manager.broadcast({"type": "update", "graph": new_graph, "summary": "删除连接"})
    return {"ok": True}


# ─── WebSocket ──────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    await websocket.send_json({"type": "init", "graph": db.get_mindmap()})
    try:
        while True:
            await websocket.receive_text()  # keep-alive
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ─── Serve Frontend ────────────────────────────────────────────────────────────

if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
