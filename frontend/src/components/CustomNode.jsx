import { memo, useState } from 'react'
import { Handle, Position } from 'reactflow'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'

const TYPE_ICONS = {
  root:     '🧠',
  topic:    '📌',
  subtopic: '◆',
  action:   '✅',
  idea:     '💡',
  project:  '🚀',
  note:     '📝',
}

const TYPE_LABELS = {
  root:     '核心',
  topic:    '主题',
  subtopic: '要点',
  action:   '行动',
  idea:     '想法',
  project:  '项目',
  note:     '备注',
}

function CustomNode({ data, selected }) {
  const [expanded, setExpanded] = useState(true)
  const { label, description, type, style } = data

  const icon = TYPE_ICONS[type] || '◆'
  const typeLabel = TYPE_LABELS[type] || type

  const handleDelete = (e) => {
    e.stopPropagation()
    fetch(`/api/nodes/${data.id}`, { method: 'DELETE' })
  }

  return (
    <div
      className="group relative select-none"
      style={{
        minWidth: type === 'root' ? 140 : 120,
        maxWidth: 200,
      }}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: style.border, width: 6, height: 6, border: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: style.border, width: 6, height: 6, border: 'none' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: style.border, width: 6, height: 6, border: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: style.border, width: 6, height: 6, border: 'none' }}
      />

      {/* Card */}
      <div
        className="rounded-xl transition-all duration-200"
        style={{
          background: style.bg,
          border: `1.5px solid ${selected ? '#ffffff55' : style.border}`,
          boxShadow: selected
            ? `0 0 0 2px ${style.border}55, 0 8px 24px rgba(0,0,0,0.4)`
            : `0 2px 12px rgba(0,0,0,0.3)`,
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
          <span className="text-sm leading-none">{icon}</span>
          <span
            className="flex-1 font-semibold text-sm leading-snug"
            style={{ color: style.text }}
          >
            {label}
          </span>
          {description && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
              style={{ color: style.text }}
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>

        {/* Type badge */}
        <div className="flex items-center justify-between px-3 pb-2">
          <span
            className="text-[10px] rounded-full px-1.5 py-0.5 font-medium"
            style={{
              background: `${style.border}22`,
              color: style.border,
            }}
          >
            {typeLabel}
          </span>
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity text-red-400 hover:text-red-300"
          >
            <Trash2 size={11} />
          </button>
        </div>

        {/* Description (expandable) */}
        {description && expanded && (
          <div
            className="px-3 pb-2.5 text-[11px] leading-relaxed border-t"
            style={{
              borderColor: `${style.border}22`,
              color: `${style.text}99`,
            }}
          >
            {description}
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(CustomNode)
