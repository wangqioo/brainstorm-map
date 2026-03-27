import { useMindMapStore, getNodeStyle } from '../store/mindmapStore'
import { Trash2 } from 'lucide-react'

const COLUMNS = [
  { key: 'root',     label: '核心主题', icon: '🧠' },
  { key: 'project',  label: '项目',     icon: '🚀' },
  { key: 'topic',    label: '主要话题', icon: '📌' },
  { key: 'action',   label: '待办行动', icon: '✅' },
  { key: 'idea',     label: '创意想法', icon: '💡' },
  { key: 'subtopic', label: '细节要点', icon: '◆' },
  { key: 'note',     label: '备注',     icon: '📝' },
]

function KanbanCard({ node }) {
  const style = getNodeStyle(node.type)
  const handleDelete = () => fetch(`/api/nodes/${node.id}`, { method: 'DELETE' })

  return (
    <div
      className="group rounded-xl p-3 mb-2 transition-all hover:scale-[1.01]"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}55`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-sm" style={{ color: style.text }}>
          {node.label}
        </span>
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-red-400 transition-opacity shrink-0"
        >
          <Trash2 size={11} />
        </button>
      </div>
      {node.description && (
        <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: `${style.text}88` }}>
          {node.description}
        </p>
      )}
      {node.category && (
        <span
          className="inline-block mt-2 text-[10px] rounded px-1.5 py-0.5"
          style={{ background: `${style.border}22`, color: style.border }}
        >
          {node.category}
        </span>
      )}
    </div>
  )
}

export default function KanbanView() {
  const { nodes } = useMindMapStore()

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-600">
        <span className="text-4xl mb-3">📋</span>
        <p className="text-sm">暂无内容</p>
      </div>
    )
  }

  const nodesByType = {}
  nodes.forEach(n => {
    const t = n.type || 'idea'
    if (!nodesByType[t]) nodesByType[t] = []
    nodesByType[t].push(n)
  })

  const usedColumns = COLUMNS.filter(c => nodesByType[c.key]?.length > 0)

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden p-4">
      <div className="flex gap-4 h-full" style={{ minWidth: usedColumns.length * 220 }}>
        {usedColumns.map(col => {
          const items = nodesByType[col.key] || []
          const style = getNodeStyle(col.key)
          return (
            <div
              key={col.key}
              className="flex flex-col rounded-2xl w-52 shrink-0"
              style={{
                background: '#161b22',
                border: `1px solid ${style.border}33`,
              }}
            >
              {/* Column header */}
              <div
                className="flex items-center gap-2 px-4 py-3 border-b"
                style={{ borderColor: `${style.border}22` }}
              >
                <span>{col.icon}</span>
                <span className="font-semibold text-sm" style={{ color: style.border }}>
                  {col.label}
                </span>
                <span
                  className="ml-auto text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
                  style={{ background: `${style.border}22`, color: style.border }}
                >
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-3">
                {items.map(n => <KanbanCard key={n.id} node={n} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
