/**
 * Layout algorithms for mind map visualization.
 * Uses dagre for hierarchical/flowchart layouts.
 * Custom radial algorithm for mind map mode.
 */
import dagre from '@dagrejs/dagre'

const NODE_WIDTH = 160
const NODE_HEIGHT = 70

// ─── Dagre Hierarchical Layout (flowchart / tree) ──────────────────────────────

export function dagreLayout(nodes, edges, direction = 'TB') {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    nodesep: 40,
    ranksep: 80,
    marginx: 60,
    marginy: 60,
  })

  nodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach(e => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return nodes.map(n => {
    const pos = g.node(n.id)
    return {
      ...n,
      position: {
        x: pos ? pos.x - NODE_WIDTH / 2 : 0,
        y: pos ? pos.y - NODE_HEIGHT / 2 : 0,
      }
    }
  })
}

// ─── Radial Mind Map Layout ────────────────────────────────────────────────────

export function radialLayout(nodes, edges) {
  if (nodes.length === 0) return nodes

  // Build adjacency map
  const children = {}
  const parents = {}
  nodes.forEach(n => { children[n.id] = []; parents[n.id] = null })
  edges.forEach(e => {
    children[e.source]?.push(e.target)
    parents[e.target] = e.source
  })

  // Find root(s): nodes with no parents that are root type, or any node with most children
  const rootNodes = nodes.filter(n => n.data?.type === 'root' || !parents[n.id])
  const root = rootNodes[0] || nodes[0]
  if (!root) return nodes

  const positions = {}
  const RADII = [0, 220, 380, 520, 640]  // radius per level

  function placeNode(nodeId, level, startAngle, endAngle) {
    const angle = (startAngle + endAngle) / 2
    const r = RADII[Math.min(level, RADII.length - 1)]
    positions[nodeId] = {
      x: Math.cos(angle) * r - NODE_WIDTH / 2,
      y: Math.sin(angle) * r - NODE_HEIGHT / 2,
    }

    const kids = children[nodeId] || []
    if (kids.length === 0) return

    const slice = (endAngle - startAngle) / kids.length
    kids.forEach((kid, i) => {
      placeNode(kid, level + 1, startAngle + i * slice, startAngle + (i + 1) * slice)
    })
  }

  placeNode(root.id, 0, -Math.PI, Math.PI)

  // Place any disconnected nodes in a grid below
  let gridX = 0, gridY = 700
  nodes.forEach(n => {
    if (!positions[n.id]) {
      positions[n.id] = { x: gridX, y: gridY }
      gridX += NODE_WIDTH + 20
      if (gridX > 800) { gridX = 0; gridY += NODE_HEIGHT + 20 }
    }
  })

  return nodes.map(n => ({
    ...n,
    position: positions[n.id] || { x: 0, y: 0 }
  }))
}

// ─── Force / Network Layout (simple spring initialization) ────────────────────

export function forceLayout(nodes, edges) {
  // Simple circular placement as a starting point
  // ReactFlow's built-in force simulation handles the rest
  const n = nodes.length
  const R = Math.max(180, n * 30)
  return nodes.map((node, i) => ({
    ...node,
    position: {
      x: Math.cos((2 * Math.PI * i) / n) * R - NODE_WIDTH / 2,
      y: Math.sin((2 * Math.PI * i) / n) * R - NODE_HEIGHT / 2,
    }
  }))
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function applyLayout(nodes, edges, mode) {
  if (nodes.length === 0) return nodes
  switch (mode) {
    case 'flowchart': return dagreLayout(nodes, edges, 'LR')
    case 'tree':      return dagreLayout(nodes, edges, 'TB')
    case 'network':   return forceLayout(nodes, edges)
    case 'mindmap':
    default:          return radialLayout(nodes, edges)
  }
}
