import { useCallback, useEffect, useMemo, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
} from 'reactflow'
import { useMindMapStore, getNodeStyle } from '../store/mindmapStore'
import { applyLayout } from '../utils/layout'
import CustomNode from './CustomNode'

const nodeTypes = { brainNode: CustomNode }

export default function MindMapView() {
  const { nodes: storeNodes, edges: storeEdges, viewMode, processing } = useMindMapStore()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const prevNodeIds = useRef(new Set())

  // Convert store data → ReactFlow nodes/edges with layout
  useEffect(() => {
    if (storeNodes.length === 0) {
      setNodes([])
      setEdges([])
      prevNodeIds.current = new Set()
      return
    }

    const newNodeIds = new Set(storeNodes.map(n => n.id))

    // Build raw ReactFlow nodes
    const rawNodes = storeNodes.map(n => ({
      id: n.id,
      type: 'brainNode',
      position: { x: n.pos_x || 0, y: n.pos_y || 0 },
      data: {
        id: n.id,
        label: n.label,
        description: n.description,
        type: n.type || 'idea',
        category: n.category,
        style: getNodeStyle(n.type),
      }
    }))

    const rawEdges = storeEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label || undefined,
      type: 'smoothstep',
      animated: processing,
      style: { stroke: '#6366f1', strokeWidth: 1.5 },
      labelStyle: { fill: '#94a3b8', fontSize: 11 },
      labelBgStyle: { fill: '#161b22', fillOpacity: 0.9 },
    }))

    // Check if it's a structural change (new/removed nodes) or just an update
    const hasStructuralChange =
      storeNodes.some(n => !prevNodeIds.current.has(n.id)) ||
      prevNodeIds.current.size !== storeNodes.length

    let finalNodes = rawNodes

    if (hasStructuralChange) {
      // Re-run layout only when structure changes
      finalNodes = applyLayout(rawNodes, rawEdges, viewMode)
    } else {
      // Preserve user-dragged positions
      setNodes(prev => {
        const posMap = {}
        prev.forEach(n => { posMap[n.id] = n.position })
        return rawNodes.map(n => ({
          ...n,
          position: posMap[n.id] || n.position,
        }))
      })
      setEdges(rawEdges)
      prevNodeIds.current = newNodeIds
      return
    }

    setNodes(finalNodes)
    setEdges(rawEdges)
    prevNodeIds.current = newNodeIds
  }, [storeNodes, storeEdges, viewMode, processing])

  // Re-layout when view mode changes (user switches view)
  const prevViewMode = useRef(viewMode)
  useEffect(() => {
    if (prevViewMode.current === viewMode) return
    prevViewMode.current = viewMode

    if (nodes.length === 0) return
    const laid = applyLayout(nodes, edges, viewMode)
    setNodes(laid)
  }, [viewMode])

  // Save position on drag end
  const onNodeDragStop = useCallback((_, node) => {
    fetch(`/api/nodes/${node.id}/position`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: node.position.x, y: node.position.y }),
    })
  }, [])

  // Manual edge creation by connecting handles
  const onConnect = useCallback((params) => {
    fetch('/api/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: params.source, target: params.target }),
    })
  }, [])

  const minimapColor = (node) => {
    const s = getNodeStyle(node.data?.type || 'idea')
    return s.border
  }

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={3}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#30363d"
        />
        <Controls
          className="!left-4 !bottom-4"
          showInteractive={false}
        />
        <MiniMap
          nodeColor={minimapColor}
          className="!bottom-4 !right-4"
          maskColor="rgba(13,17,23,0.8)"
          style={{ background: '#161b22' }}
        />
      </ReactFlow>

      {/* Empty state */}
      {nodes.length === 0 && !processing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-6xl mb-4 opacity-30">🧠</div>
          <p className="text-slate-500 text-lg font-medium">开始记录你的想法</p>
          <p className="text-slate-600 text-sm mt-1">输入文字或按下麦克风开始</p>
        </div>
      )}

      {/* Processing overlay */}
      {processing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="flex items-center gap-2 bg-brand/20 border border-brand/40 rounded-full px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-brand animate-ping" />
            <span className="text-brand-light text-sm font-medium">AI 正在处理...</span>
          </div>
        </div>
      )}
    </div>
  )
}
