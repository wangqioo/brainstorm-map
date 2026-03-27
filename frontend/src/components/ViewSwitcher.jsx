import { useMindMapStore } from '../store/mindmapStore'
import { Share2, GitBranch, AlignLeft, LayoutGrid, Network } from 'lucide-react'

const VIEWS = [
  { id: 'mindmap',   label: '思维导图', icon: Share2,      desc: '放射状中心布局' },
  { id: 'flowchart', label: '流程图',   icon: GitBranch,   desc: '左右层级流程' },
  { id: 'outline',   label: '大纲',     icon: AlignLeft,   desc: '层级文本列表' },
  { id: 'kanban',    label: '看板',     icon: LayoutGrid,  desc: '按类型分栏' },
  { id: 'network',   label: '网络图',   icon: Network,     desc: '力导向关系图' },
]

export default function ViewSwitcher() {
  const { viewMode, setViewMode } = useMindMapStore()

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-surface-border bg-surface shrink-0">
      {VIEWS.map(v => {
        const Icon = v.icon
        const active = viewMode === v.id
        return (
          <button
            key={v.id}
            onClick={() => setViewMode(v.id)}
            title={v.desc}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              active
                ? 'bg-brand text-white shadow-lg shadow-brand/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-surface-raised'
            }`}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{v.label}</span>
          </button>
        )
      })}
    </div>
  )
}
