import { useEffect } from 'react'
import { useMindMapStore } from './store/mindmapStore'
import { useWebSocket } from './hooks/useWebSocket'
import Sidebar from './components/Sidebar'
import ViewSwitcher from './components/ViewSwitcher'
import MindMapView from './components/MindMapView'
import OutlineView from './components/OutlineView'
import KanbanView from './components/KanbanView'
import InputPanel from './components/InputPanel'

// Network view uses the same ReactFlow but with force layout
// It's just MindMapView with viewMode='network'

export default function App() {
  const { viewMode } = useMindMapStore()

  // Connect WebSocket for real-time updates
  useWebSocket()

  const renderView = () => {
    switch (viewMode) {
      case 'outline':  return <OutlineView />
      case 'kanban':   return <KanbanView />
      case 'mindmap':
      case 'flowchart':
      case 'network':
      default:         return <MindMapView />
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface text-slate-200">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* View mode tabs */}
        <ViewSwitcher />

        {/* Visualization area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {renderView()}
        </div>

        {/* Text/Voice input bar */}
        <InputPanel />
      </div>
    </div>
  )
}
