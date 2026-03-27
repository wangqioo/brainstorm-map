import { create } from 'zustand'

const NODE_COLORS = {
  root:     { bg: '#1e1b4b', border: '#6366f1', text: '#a5b4fc' },
  topic:    { bg: '#1a1040', border: '#8b5cf6', text: '#c4b5fd' },
  subtopic: { bg: '#0f172a', border: '#3b82f6', text: '#93c5fd' },
  action:   { bg: '#052e16', border: '#22c55e', text: '#86efac' },
  idea:     { bg: '#1c1400', border: '#f59e0b', text: '#fcd34d' },
  project:  { bg: '#1a0a20', border: '#e879f9', text: '#f0abfc' },
  note:     { bg: '#0c1a1a', border: '#14b8a6', text: '#5eead4' },
}

export const getNodeStyle = (type) =>
  NODE_COLORS[type] || NODE_COLORS.idea

export const useMindMapStore = create((set, get) => ({
  // Graph data
  nodes: [],
  edges: [],

  // UI state
  viewMode: 'mindmap',  // mindmap | flowchart | outline | kanban | network
  processing: false,
  processingText: '',
  lastSummary: '',
  connected: false,
  ollamaOnline: false,
  selectedModel: 'qwen2.5:7b',
  availableModels: [],
  sidebarOpen: true,

  // Set connected status
  setConnected: (v) => set({ connected: v }),
  setOllamaOnline: (v, models = []) => set({ ollamaOnline: v, availableModels: models }),
  setViewMode: (v) => set({ viewMode: v }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setSelectedModel: (v) => set({ selectedModel: v }),

  // Update graph from server
  setGraph: (graph) => {
    const { nodes: rawNodes, edges: rawEdges } = graph
    set({
      nodes: rawNodes,
      edges: rawEdges,
    })
  },

  // Processing indicator
  setProcessing: (v, text = '') => set({ processing: v, processingText: text }),
  setLastSummary: (v) => set({ lastSummary: v }),

  // Get ReactFlow-compatible nodes
  getFlowNodes: () => {
    const { nodes } = get()
    return nodes.map(n => ({
      id: n.id,
      type: 'brainNode',
      position: { x: n.pos_x || 0, y: n.pos_y || 0 },
      data: {
        label: n.label,
        description: n.description,
        type: n.type,
        category: n.category,
        style: getNodeStyle(n.type),
      }
    }))
  },

  // Get ReactFlow-compatible edges
  getFlowEdges: () => {
    const { edges } = get()
    return edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label || undefined,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#6366f1', strokeWidth: 1.5 },
      labelStyle: { fill: '#94a3b8', fontSize: 11 },
      labelBgStyle: { fill: '#161b22', fillOpacity: 0.9 },
    }))
  },
}))
