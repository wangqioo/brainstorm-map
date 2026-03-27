import { useMindMapStore } from '../store/mindmapStore'
import { Trash2 } from 'lucide-react'

const TYPE_COLORS = {
  root:     'text-indigo-400',
  topic:    'text-purple-400',
  subtopic: 'text-blue-400',
  action:   'text-green-400',
  idea:     'text-amber-400',
  project:  'text-fuchsia-400',
  note:     'text-teal-400',
}

const TYPE_BULLET = {
  root:     '■',
  topic:    '●',
  subtopic: '▸',
  action:   '☐',
  idea:     '◈',
  project:  '◉',
  note:     '◇',
}

function buildTree(nodes, edges) {
  const children = {}
  const hasParent = new Set()
  nodes.forEach(n => { children[n.id] = [] })
  edges.forEach(e => {
    children[e.source]?.push(e.target)
    hasParent.add(e.target)
  })
  const roots = nodes.filter(n => !hasParent.has(n.id))
  return { roots, children, nodeMap: Object.fromEntries(nodes.map(n => [n.id, n])) }
}

function TreeNode({ node, children: childIds, nodeMap, childrenMap, depth = 0 }) {
  const typeColor = TYPE_COLORS[node.type] || 'text-slate-400'
  const bullet = TYPE_BULLET[node.type] || '▸'

  const handleDelete = (e) => {
    e.stopPropagation()
    fetch(`/api/nodes/${node.id}`, { method: 'DELETE' })
  }

  return (
    <div>
      <div
        className="group flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-raised transition-colors cursor-default"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <span className={`mt-0.5 text-xs font-bold ${typeColor}`}>{bullet}</span>
        <div className="flex-1 min-w-0">
          <span className={`font-medium text-sm ${typeColor}`}>{node.label}</span>
          {node.description && (
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed truncate">
              {node.description}
            </p>
          )}
        </div>
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-red-400 transition-opacity mt-0.5"
        >
          <Trash2 size={12} />
        </button>
      </div>
      {childIds.map(cid => {
        const child = nodeMap[cid]
        if (!child) return null
        return (
          <TreeNode
            key={cid}
            node={child}
            children={childrenMap[cid] || []}
            nodeMap={nodeMap}
            childrenMap={childrenMap}
            depth={depth + 1}
          />
        )
      })}
    </div>
  )
}

export default function OutlineView() {
  const { nodes, edges } = useMindMapStore()
  const { roots, children, nodeMap } = buildTree(nodes, edges)

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-600">
        <span className="text-4xl mb-3">📋</span>
        <p className="text-sm">暂无内容</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-4">
          大纲视图 · {nodes.length} 个节点
        </h2>
        <div className="space-y-0.5">
          {roots.map(root => (
            <TreeNode
              key={root.id}
              node={root}
              children={children[root.id] || []}
              nodeMap={nodeMap}
              childrenMap={children}
              depth={0}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
