import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Send, Loader2, Zap } from 'lucide-react'
import { useMindMapStore } from '../store/mindmapStore'
import { useVoice } from '../hooks/useVoice'

export default function InputPanel() {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const { processing, processingText, lastSummary, selectedModel } = useMindMapStore()
  const textareaRef = useRef(null)

  const { recording, toggle: toggleVoice } = useVoice({
    onProcessing: (msg) => setStatusMsg(msg),
    onTranscript: (transcript, summary) => {
      setStatusMsg(`识别: ${transcript}`)
      setTimeout(() => setStatusMsg(''), 3000)
    },
    onError: (err) => {
      setStatusMsg(`错误: ${err}`)
      setTimeout(() => setStatusMsg(''), 4000)
    }
  })

  const handleSubmit = async (e) => {
    e?.preventDefault()
    const content = text.trim()
    if (!content || submitting || processing) return

    setSubmitting(true)
    setText('')

    try {
      const res = await fetch('/api/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, model: selectedModel }),
      })
      if (!res.ok) {
        const err = await res.json()
        setStatusMsg(`失败: ${err.detail}`)
      }
    } catch (err) {
      setStatusMsg(`网络错误: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [text])

  const isProcessing = processing || submitting

  return (
    <div className="p-3 border-t border-surface-border bg-surface">
      {/* Status / summary bar */}
      {(statusMsg || (processing && processingText) || lastSummary) && (
        <div className="mb-2 px-3 py-1.5 rounded-lg text-xs bg-surface-raised border border-surface-border">
          {statusMsg ? (
            <span className="text-amber-400">{statusMsg}</span>
          ) : processing ? (
            <span className="text-brand-light flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" />
              {processingText || 'AI 处理中...'}
            </span>
          ) : lastSummary ? (
            <span className="text-slate-400">
              <Zap size={10} className="inline mr-1 text-brand" />
              {lastSummary}
            </span>
          ) : null}
        </div>
      )}

      {/* Input row */}
      <div
        className={`flex items-end gap-2 rounded-2xl border px-3 py-2 transition-all ${
          isProcessing
            ? 'border-brand/50 processing-pulse'
            : recording
            ? 'border-red-500/60'
            : 'border-surface-border hover:border-brand/40 focus-within:border-brand/60'
        }`}
        style={{ background: '#161b22' }}
      >
        {/* Voice button */}
        <button
          onClick={toggleVoice}
          disabled={isProcessing}
          title={recording ? '停止录音 (FunASR)' : '语音输入 (FunASR)'}
          className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 ${
            recording
              ? 'bg-red-500/20 text-red-400 animate-pulse'
              : 'text-slate-500 hover:text-brand hover:bg-brand/10'
          }`}
        >
          {recording ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={recording ? '录音中... 松开按钮结束' : '输入想法、项目计划、灵感...（Enter 发送，Shift+Enter 换行）'}
          disabled={recording || isProcessing}
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-200 placeholder-slate-600 leading-relaxed py-0.5"
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || isProcessing || recording}
          className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 bg-brand/10 text-brand hover:bg-brand hover:text-white disabled:hover:bg-brand/10 disabled:hover:text-brand"
        >
          {isProcessing ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
        </button>
      </div>

      {/* Voice recording indicator */}
      {recording && (
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-red-400">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          录音中 · 点击麦克风停止并识别
        </div>
      )}
    </div>
  )
}
