# BrainMap 部署指南

## 整体架构

```
手机/电脑浏览器
    │
    │ HTTPS (穿透)
    ▼
[SPARK2] BrainMap Backend :8000
    │                │
    │ WebSocket       │ HTTP (局域网)
    ▼                ▼
FunASR :10095    [SPARK1] vLLM :8000
(语音识别)        (Qwen3.5)
```

---

## 第一步：启动 vLLM (SPARK1)

```bash
# 安装 vLLM
pip install vllm

# 启动 Qwen3.5 (根据你的显存选择合适的量化)
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen3.5-7B-Instruct \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype auto \
  --max-model-len 8192

# 验证
curl http://spark1:8000/v1/models
```

---

## 第二步：启动 FunASR (SPARK2)

### 方式 A: Docker (推荐)

```bash
docker pull registry.cn-hangzhou.aliyuncs.com/modelscope-repo/funasr:latest

docker run -d \
  --name funasr \
  -p 10095:10095 \
  registry.cn-hangzhou.aliyuncs.com/modelscope-repo/funasr:latest \
  python -m funasr.runtime.python.http_server.funasr_server \
    --host 0.0.0.0 \
    --port 10095 \
    --asr_model paraformer-zh \
    --asr_model_online paraformer-zh-streaming \
    --vad_model fsmn-vad \
    --punc_model ct-punc
```

### 方式 B: 原生安装

```bash
pip install funasr modelscope
python -m funasr.runtime.python.http_server.funasr_server \
  --host 0.0.0.0 --port 10095 \
  --asr_model paraformer-zh \
  --vad_model fsmn-vad \
  --punc_model ct-punc
```

---

## 第三步：配置并启动 BrainMap (SPARK2)

```bash
# 克隆/复制项目到 SPARK2
cd /opt/brainstorm-map

# 配置环境变量
cp backend/.env.example backend/.env
nano backend/.env
# 修改:
#   VLLM_BASE_URL=http://192.168.1.101:8000   ← SPARK1 的 IP
#   VLLM_MODEL=Qwen/Qwen3.5-7B-Instruct
#   FUNASR_HOST=localhost
#   FUNASR_PORT=10095

# 构建前端 + 启动后端
chmod +x start.sh
./start.sh prod
```

---

## 第四步：配置远程穿透

### 方式 A: frp (推荐，适合局域网+公网)

```bash
# 你的公网服务器上运行 frps (服务端)
# frps.ini:
[common]
bind_port = 7000

# SPARK2 上运行 frpc (客户端)
# frpc.ini:
[common]
server_addr = your.public.server.com
server_port = 7000

[brainstorm]
type = http
local_ip = 127.0.0.1
local_port = 8000
custom_domains = brain.yourdomain.com

# 启动
frpc -c frpc.ini
```

### 方式 B: Cloudflare Tunnel (最简单，免费)

```bash
# 安装 cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64

# 一键穿透 (临时URL，测试用)
./cloudflared tunnel --url http://localhost:8000

# 或绑定自定义域名 (需要 CF 账号)
./cloudflared tunnel create brainstorm
./cloudflared tunnel route dns brainstorm brain.yourdomain.com
./cloudflared tunnel run --url http://localhost:8000 brainstorm
```

### 方式 C: ngrok

```bash
ngrok http 8000
```

---

## 第五步：设为系统服务 (开机自启)

```bash
# /etc/systemd/system/brainstorm.service
[Unit]
Description=BrainMap Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/brainstorm-map/backend
EnvironmentFile=/opt/brainstorm-map/backend/.env
ExecStart=/usr/local/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target

# 启用
systemctl enable brainstorm
systemctl start brainstorm
```

---

## API 接口说明

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 查看 vLLM + FunASR 状态 |
| `/api/mindmap` | GET | 获取当前完整导图 |
| `/api/input` | POST | 文字输入 → AI 更新导图 |
| `/api/voice-input` | POST | 音频文件 → FunASR → AI → 导图 |
| `/api/transcribe` | POST | 仅语音转文字（不更新导图） |
| `/api/nodes` | POST | 手动创建节点 |
| `/api/nodes/{id}` | DELETE | 删除节点 |
| `/api/edges` | POST | 手动创建连接 |
| `/api/history` | GET | 输入历史 |
| `/ws` | WS | 实时推送（WebSocket）|
| `/docs` | GET | FastAPI 文档 |

---

## 节点类型

| 类型 | 颜色 | 用途 |
|------|------|------|
| `root` | 靛蓝 | 核心主题 |
| `topic` | 紫色 | 主要话题 |
| `subtopic` | 蓝色 | 细节要点 |
| `action` | 绿色 | 待办/行动项 |
| `idea` | 琥珀 | 创意灵感 |
| `project` | 洋红 | 开发项目 |
| `note` | 青色 | 备注参考 |

---

## 视图模式

| 视图 | 说明 |
|------|------|
| 思维导图 | 放射状中心布局，适合头脑风暴 |
| 流程图 | 左右层级流程，适合项目梳理 |
| 大纲 | 层级文本列表，适合内容整理 |
| 看板 | 按节点类型分栏，适合任务管理 |
| 网络图 | 力导向关系图，适合探索关联 |
