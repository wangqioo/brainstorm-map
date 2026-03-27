"""
SQLite database layer for the brainstorm mind map application.
Stores nodes, edges, and session history.
"""
import json
import sqlite3
from typing import Optional
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "mindmap.db"


def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            type TEXT DEFAULT 'idea',
            description TEXT DEFAULT '',
            category TEXT DEFAULT '',
            pos_x REAL DEFAULT 0,
            pos_y REAL DEFAULT 0,
            created_at REAL DEFAULT (unixepoch('now')),
            updated_at REAL DEFAULT (unixepoch('now'))
        );

        CREATE TABLE IF NOT EXISTS edges (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            target TEXT NOT NULL,
            label TEXT DEFAULT '',
            FOREIGN KEY (source) REFERENCES nodes(id) ON DELETE CASCADE,
            FOREIGN KEY (target) REFERENCES nodes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            input_text TEXT,
            summary TEXT,
            created_at REAL DEFAULT (unixepoch('now'))
        );

        PRAGMA foreign_keys = ON;
    """)
    conn.commit()
    conn.close()


def get_mindmap() -> dict:
    conn = get_connection()
    cur = conn.cursor()
    nodes = [dict(r) for r in cur.execute("SELECT * FROM nodes ORDER BY created_at").fetchall()]
    edges = [dict(r) for r in cur.execute("SELECT * FROM edges").fetchall()]
    conn.close()
    return {"nodes": nodes, "edges": edges}


def apply_updates(updates: dict) -> dict:
    """
    Apply LLM-generated diff to the database.
    updates = {
        "additions": {"nodes": [...], "edges": [...]},
        "removals": {"node_ids": [...], "edge_ids": [...]},
        "updates": {"nodes": [{"id": ..., ...}]}
    }
    """
    conn = get_connection()
    cur = conn.cursor()

    additions = updates.get("additions", {})
    removals = updates.get("removals", {})
    node_updates = updates.get("updates", {}).get("nodes", [])

    # Add new nodes
    for node in additions.get("nodes", []):
        cur.execute("""
            INSERT OR REPLACE INTO nodes (id, label, type, description, category)
            VALUES (:id, :label, :type, :description, :category)
        """, {
            "id": node.get("id", ""),
            "label": node.get("label", ""),
            "type": node.get("type", "idea"),
            "description": node.get("description", ""),
            "category": node.get("category", ""),
        })

    # Add new edges
    for edge in additions.get("edges", []):
        cur.execute("""
            INSERT OR REPLACE INTO edges (id, source, target, label)
            VALUES (:id, :source, :target, :label)
        """, {
            "id": edge.get("id", f"{edge.get('source')}-{edge.get('target')}"),
            "source": edge.get("source", ""),
            "target": edge.get("target", ""),
            "label": edge.get("label", ""),
        })

    # Remove nodes (cascades to edges via FK)
    for node_id in removals.get("node_ids", []):
        cur.execute("DELETE FROM edges WHERE source=? OR target=?", (node_id, node_id))
        cur.execute("DELETE FROM nodes WHERE id=?", (node_id,))

    # Remove edges
    for edge_id in removals.get("edge_ids", []):
        cur.execute("DELETE FROM edges WHERE id=?", (edge_id,))

    # Update existing nodes
    for node in node_updates:
        fields = {k: v for k, v in node.items() if k != "id"}
        if fields:
            sets = ", ".join(f"{k}=?" for k in fields)
            cur.execute(
                f"UPDATE nodes SET {sets}, updated_at=unixepoch('now') WHERE id=?",
                list(fields.values()) + [node["id"]]
            )

    conn.commit()
    conn.close()
    return get_mindmap()


def update_node_position(node_id: str, x: float, y: float):
    conn = get_connection()
    conn.execute("UPDATE nodes SET pos_x=?, pos_y=? WHERE id=?", (x, y, node_id))
    conn.commit()
    conn.close()


def clear_mindmap():
    conn = get_connection()
    conn.execute("DELETE FROM edges")
    conn.execute("DELETE FROM nodes")
    conn.commit()
    conn.close()


def add_history(input_text: str, summary: str):
    conn = get_connection()
    conn.execute(
        "INSERT INTO history (input_text, summary) VALUES (?, ?)",
        (input_text, summary)
    )
    conn.commit()
    conn.close()


def get_history(limit: int = 20) -> list:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM history ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# Initialize on import
init_db()
