import { useEffect, useRef } from 'react'
import { useMindMapStore } from '../store/mindmapStore'

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
const RECONNECT_DELAY = 3000

export function useWebSocket() {
  const ws = useRef(null)
  const reconnectTimer = useRef(null)
  const { setGraph, setConnected, setProcessing, setLastSummary } = useMindMapStore()

  const connect = () => {
    if (ws.current?.readyState === WebSocket.OPEN) return

    const socket = new WebSocket(WS_URL)
    ws.current = socket

    socket.onopen = () => {
      setConnected(true)
      clearTimeout(reconnectTimer.current)
    }

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'init':
          case 'update':
            setGraph(msg.graph)
            if (msg.summary) setLastSummary(msg.summary)
            setProcessing(false)
            break
          case 'processing':
            setProcessing(true, msg.text || '')
            break
          default:
            break
        }
      } catch (e) {
        console.warn('[WS] Parse error:', e)
      }
    }

    socket.onclose = () => {
      setConnected(false)
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
    }

    socket.onerror = () => {
      socket.close()
    }
  }

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [])
}
