"""
vLLM client (OpenAI-compatible API) for extracting structured knowledge from input.
Connects to SPARK1's vLLM server running Qwen 3.5.
"""
import json
import re
import uuid
import aiohttp
import os
from typing import Optional

# vLLM server on SPARK1 (OpenAI-compatible)
VLLM_BASE_URL = os.getenv("VLLM_BASE_URL", "http://spark1:8000")
VLLM_MODEL = os.getenv("VLLM_MODEL", "Qwen/Qwen3.5-7B-Instruct")
VLLM_API_KEY = os.getenv("VLLM_API_KEY", "EMPTY")  # vLLM default

SYSTEM_PROMPT = """你是一个知识图谱提取助手。分析用户输入，提取关键概念和它们之间的关系，生成思维导图的更新。
只输出 JSON，不输出任何其他文字。

节点类型说明:
- root: 整个导图的核心主题 (每图最多1个)
- topic: 主要话题 (通常3-7个)
- subtopic: 具体要点
- action: 待办事项/行动项
- idea: 创意灵感
- project: 正在开发的项目
- note: 备注/参考

输出格式 (严格 JSON, 无多余文字):
{
  "summary": "一句话总结",
  "additions": {
    "nodes": [{"id":"uid","label":"简短标签(≤6字)","type":"类型","description":"详细描述","category":"分类(可空)"}],
    "edges": [{"id":"e-src-tgt","source":"源ID","target":"目标ID","label":"关系"}]
  },
  "removals": {"node_ids":[],"edge_ids":[]},
  "updates": {"nodes":[{"id":"...","label":"...","description":"..."}]}
}

规则:
- 用户说"删除/去掉/移除"时，把对应节点ID放入 removals.node_ids
- 已有节点不重复创建，用 updates 修改或加子节点
- 没变化的部分留空数组即可
- 标签用中文，除非用户用英文"""


def _fallback_parse(text: str, existing_nodes: list) -> dict:
    node_id = str(uuid.uuid4())[:8]
    root_nodes = [n for n in existing_nodes if n.get("type") == "root"]
    nodes = [{"id": node_id, "label": text.strip()[:12], "type": "idea",
               "description": text, "category": ""}]
    edges = []
    if root_nodes:
        edges.append({"id": f"e-{root_nodes[0]['id']}-{node_id}",
                       "source": root_nodes[0]["id"], "target": node_id, "label": ""})
    return {
        "summary": f"添加想法: {text.strip()[:20]}",
        "additions": {"nodes": nodes, "edges": edges},
        "removals": {"node_ids": [], "edge_ids": []},
        "updates": {"nodes": []}
    }


async def process_input(
    user_text: str,
    existing_graph: dict,
    model: str = None
) -> dict:
    """Call vLLM (OpenAI-compatible) to get mind map diff."""
    model = VLLM_MODEL  # Always use server-configured model; ignore frontend hint
    existing_summary = _summarize_graph(existing_graph)

    user_prompt = (
        f"当前思维导图:\n{existing_summary}\n\n"
        f"用户输入:\n{user_text}\n\n"
        "请生成思维导图更新 (JSON)。"
    )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 2048,
        # Disable Qwen3.5 chain-of-thought for faster responses
        "chat_template_kwargs": {"enable_thinking": False},
    }

    headers = {
        "Authorization": f"Bearer {VLLM_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=90)
        ) as session:
            async with session.post(
                f"{VLLM_BASE_URL}/v1/chat/completions",
                json=payload,
                headers=headers
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    raise Exception(f"vLLM {resp.status}: {body[:200]}")
                data = await resp.json()
                content = data["choices"][0]["message"]["content"]
                return _parse_llm_response(content, existing_graph.get("nodes", []))

    except Exception as e:
        print(f"[LLM] Error calling vLLM: {e}")
        return _fallback_parse(user_text, existing_graph.get("nodes", []))


def _summarize_graph(graph: dict) -> str:
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    if not nodes:
        return "（空图）"
    lines = [f"共 {len(nodes)} 节点，{len(edges)} 条连接"]
    for n in nodes[:25]:
        lines.append(f"  [{n['id']}] {n['label']} ({n.get('type','idea')}): {n.get('description','')[:40]}")
    return "\n".join(lines)


def _parse_llm_response(content: str, existing_nodes: list) -> dict:
    # Strip <think> tags from Qwen3.5 CoT output
    content = re.sub(r"<think>[\s\S]*?</think>", "", content).strip()

    # Extract JSON
    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
    if json_match:
        json_str = json_match.group(1)
    else:
        brace_match = re.search(r"\{[\s\S]*\}", content)
        json_str = brace_match.group(0) if brace_match else content.strip()

    try:
        result = json.loads(json_str)

        # Auto-assign IDs
        for node in result.get("additions", {}).get("nodes", []):
            if not node.get("id"):
                node["id"] = str(uuid.uuid4())[:8]
            node.setdefault("category", "")
            node.setdefault("description", "")

        for edge in result.get("additions", {}).get("edges", []):
            if not edge.get("id"):
                edge["id"] = f"e-{edge.get('source','?')}-{edge.get('target','?')}"

        # Ensure all keys exist
        result.setdefault("summary", "已更新")
        result.setdefault("additions", {"nodes": [], "edges": []})
        result.setdefault("removals", {"node_ids": [], "edge_ids": []})
        result.setdefault("updates", {"nodes": []})
        result["additions"].setdefault("nodes", [])
        result["additions"].setdefault("edges", [])
        result["removals"].setdefault("node_ids", [])
        result["removals"].setdefault("edge_ids", [])
        result["updates"].setdefault("nodes", [])
        return result

    except json.JSONDecodeError as e:
        print(f"[LLM] JSON parse error: {e}\nContent: {content[:300]}")
        return _fallback_parse("", existing_nodes)


async def check_vllm() -> dict:
    """Check if vLLM is reachable and list models."""
    try:
        headers = {"Authorization": f"Bearer {VLLM_API_KEY}"}
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=5)
        ) as session:
            async with session.get(
                f"{VLLM_BASE_URL}/v1/models", headers=headers
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    models = [m["id"] for m in data.get("data", [])]
                    return {"online": True, "models": models}
    except Exception as e:
        print(f"[LLM] vLLM check failed: {e}")
    return {"online": False, "models": []}
