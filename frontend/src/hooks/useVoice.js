/**
 * Voice recorder hook.
 * Records audio via Web Audio API (PCM 16kHz mono),
 * uploads to /api/voice-input which proxies to FunASR on SPARK2.
 */
import { useState, useRef, useCallback } from 'react'

export function useVoice({ onProcessing, onTranscript, onError }) {
  const [recording, setRecording] = useState(false)
  const audioContextRef = useRef(null)
  const processorRef = useRef(null)
  const streamRef = useRef(null)
  const samplesRef = useRef([])

  const start = useCallback(async () => {
    if (recording) return
    samplesRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true }
      })
      streamRef.current = stream

      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)

      // ScriptProcessor to capture raw Float32 PCM samples
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0)
        samplesRef.current.push(new Float32Array(float32))
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
      setRecording(true)
    } catch (err) {
      onError?.(`麦克风访问失败: ${err.message}`)
    }
  }, [recording, onError])

  const stop = useCallback(async () => {
    if (!recording) return
    setRecording(false)

    // Stop tracks
    streamRef.current?.getTracks().forEach(t => t.stop())
    processorRef.current?.disconnect()
    await audioContextRef.current?.close()

    const samples = samplesRef.current
    samplesRef.current = []

    if (samples.length === 0) return

    // Flatten Float32 → Int16 PCM
    const totalLen = samples.reduce((s, a) => s + a.length, 0)
    const pcm = new Int16Array(totalLen)
    let offset = 0
    for (const chunk of samples) {
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]))
        pcm[offset++] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
    }

    const blob = new Blob([pcm.buffer], { type: 'application/octet-stream' })
    const formData = new FormData()
    formData.append('audio', blob, 'recording.pcm')
    formData.append('format', 'pcm')

    onProcessing?.('正在识别语音...')

    try {
      const res = await fetch('/api/voice-input', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        onError?.(`识别失败: ${err.detail || res.status}`)
        return
      }
      const data = await res.json()
      onTranscript?.(data.transcript, data.summary)
    } catch (err) {
      onError?.(`网络错误: ${err.message}`)
    }
  }, [recording, onProcessing, onTranscript, onError])

  const toggle = useCallback(() => {
    if (recording) stop()
    else start()
  }, [recording, start, stop])

  return { recording, start, stop, toggle }
}
