import { useState, useEffect } from 'react'
import { History, Trash2, ChevronLeft, ChevronRight, Settings, Wifi, WifiOff } from 'lucide-react'
import { useMindMapStore } from '../store/mindmapStore'

function HistoryItem({ item }) {
  const time = new Date(item.created_at * 1000).toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit'
  })
  return (
    <div className="px-3 py-2.5 rounded-xl hover:bg-surface-raised transition-colors cursor-default">
      <div className="flex items-start gap-2">
        <span className="text-[10px] text-slate-600 mt-0.5 shrink-0">{time}</span>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 leading-snug truncate">{item.input_text}</p>
          {item.summary && (
            <p className="text-[10px] text-brand/70 mt-0.5 truncate">{item.summary}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const {
    sidebarOpen, setSidebarOpen,
    connected, ollamaOnline, availableModels,
    selectedModel, setSelectedModel,
    nodes, edges
  } = useMindMapStore()

  const [history, setHistory] = useState([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [health, setHealth] = useState(null)

  useEffect(() => {
    const fetchHistory = () =>
      fetch('/api/history?limit=20')
        .then(r => r.json())
        .then(setHistory)
        .catch(() => {})
    fetchHistory()

    const fetchHealth = () =>
      fetch('/api/health')
        .then(r => r.json())
        .then(d => {
          setHealth(d)
          useMindMapStore.getState().setOllamaOnline(
            d.vllm?.online,
            d.vllm?.models || []
          )
        })
        .catch(() => {})
    fetchHealth()

    const t = setInterval(() => { fetchHistory(); fetchHealth() }, 10000)
    return () => clearInterval(t)
  }, [])

  const handleClear = () => {
    if (confirm('清空所有节点和连接？')) {
      fetch('/api/mindmap', { method: 'DELETE' })
    }
  }

  if (!sidebarOpen) {
    return (
      <div className="flex flex-col items-center py-3 gap-3 w-10 border-r border-surface-border bg-surface shrink-0">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-slate-500 hover:text-brand transition-colors"
          title="展开侧边栏"
        >
          <ChevronRight size={16} />
        </button>
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} title={connected ? '已连接' : '未连接'} />
      </div>
    )
  }

  return (
    <div className="w-60 shrink-0 flex flex-col border-r border-surface-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <span className="font-bold text-sm text-slate-200">BrainMap</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setSettingsOpen(v => !v)} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
            <Settings size={14} />
          </button>
          <button onClick={() => setSidebarOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 px-3 py-2.5 border-b border-surface-border">
        <div className="bg-surface-raised rounded-lg px-3 py-2 text-center">
          <div className="text-xl font-bold text-brand">{nodes.length}</div>
          <div className="text-[10px] text-slate-500">节点</div>
        </div>
        <div className="bg-surface-raised rounded-lg px-3 py-2 text-center">
          <div className="text-xl font-bold text-purple-400">{edges.length}</div>
          <div className="text-[10px] text-slate-500">连接</div>
        </div>
      </div>

      {/* Status indicators */}
      <div className="px-3 py-2 flex items-center gap-3 border-b border-surface-border">
        <div className="flex items-center gap-1.5 text-[11px]">
          {connected ? <Wifi size={11} className="text-green-500" /> : <WifiOff size={11} className="text-red-500" />}
          <span className={connected ? 'text-green-500' : 'text-red-400'}>
            {connected ? '实时连接' : '连接断开'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className={`w-1.5 h-1.5 rounded-full ${health?.vllm?.online ? 'bg-green-500' : 'bg-slate-600'}`} />
          <span className={health?.vllm?.online ? 'text-green-500' : 'text-slate-500'}>
            {health?.vllm?.online ? 'vLLM' : '模型离线'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className={`w-1.5 h-1.5 rounded-full ${health?.funasr?.online ? 'bg-green-500' : 'bg-slate-600'}`} />
          <span className={health?.funasr?.online ? 'text-green-500' : 'text-slate-500'}>
            FunASR
          </span>
        </div>
      </div>

      {/* Settings panel */}
      {settingsOpen && (
        <div className="px-3 py-3 border-b border-surface-border space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">vLLM 模型</p>
          <select
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
            className="w-full bg-surface-raised border border-surface-border rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-brand/60"
          >
            {availableModels.length > 0
              ? availableModels.map(m => <option key={m} value={m}>{m}</option>)
              : <option value={selectedModel}>{selectedModel}</option>
            }
          </select>
          {health && (
            <div className="text-[10px] text-slate-600 space-y-0.5">
              <div>FunASR: {health.funasr_host}</div>
              <div>vLLM: {health.vllm_model}</div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-600 font-semibold">
            <History size={10} />
            输入历史
          </div>
          <button
            onClick={handleClear}
            className="text-slate-600 hover:text-red-400 transition-colors"
            title="清空导图"
          >
            <Trash2 size={12} />
          </button>
        </div>
        <div className="px-1 space-y-0.5 pb-4">
          {history.length === 0 ? (
            <p className="text-center text-slate-600 text-xs py-6">暂无历史</p>
          ) : (
            history.map(item => <HistoryItem key={item.id} item={item} />)
          )}
        </div>
      </div>
    </div>
  )
}
