import { useState, useRef, useEffect, useCallback } from 'react'
import { FiSend, FiVolume2, FiVolumeX } from 'react-icons/fi'
import { HiMicrophone } from 'react-icons/hi2'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { askQuestion, voiceAsk, synthesizeSpeech } from '../services/api'
import ChatMessage from './ChatMessage'

// --- Silence Detection Config ---
const SILENCE_THRESHOLD = 15
const SILENCE_DURATION_MS = 1800
const MIN_RECORDING_MS = 1000

function ChatWindow({ sessionId, setSessionId, chatHistory, setChatHistory }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [volumeLevel, setVolumeLevel] = useState(0)
  const [waveData, setWaveData] = useState(new Array(32).fill(0))
  const chatEndRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const silenceTimerRef = useRef(null)
  const recordingStartRef = useRef(null)
  const animationFrameRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      if (audioContextRef.current) audioContextRef.current.close()
    }
  }, [])

  const autoPlayAudio = async (text) => {
    if (!autoSpeak || !text) return
    try {
      setIsPlaying(true)
      const audioBlob = await synthesizeSpeech(text)
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(audioUrl) }
      audio.onerror = () => { setIsPlaying(false) }
      await audio.play()
    } catch { setIsPlaying(false) }
  }

  // --- Silence Detection with Waveform Data ---
  const startSilenceDetection = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const checkVolume = () => {
      if (!analyserRef.current) return

      analyser.getByteFrequencyData(dataArray)

      // Calculate volume
      let sum = 0
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i]
      const avg = sum / bufferLength
      const volume = Math.min(100, Math.round((avg / 128) * 100))
      setVolumeLevel(volume)

      // Extract waveform bars for visualizer
      const bars = 32
      const step = Math.floor(bufferLength / bars)
      const newWave = []
      for (let i = 0; i < bars; i++) {
        const val = dataArray[i * step] / 255
        newWave.push(val)
      }
      setWaveData(newWave)

      const elapsed = Date.now() - recordingStartRef.current

      if (elapsed > MIN_RECORDING_MS) {
        if (volume < SILENCE_THRESHOLD) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              stopRecording()
            }, SILENCE_DURATION_MS)
          }
        } else {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = null
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(checkVolume)
    }

    checkVolume()
  }, [])

  // --- Voice Recording ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
      streamRef.current = stream

      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7
      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null }
        analyserRef.current = null
        if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null }
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
        setVolumeLevel(0)
        setWaveData(new Array(32).fill(0))

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (audioBlob.size > 1000) await handleVoiceQuestion(audioBlob)
      }

      mediaRecorder.start(100)
      mediaRecorderRef.current = mediaRecorder
      recordingStartRef.current = Date.now()
      setIsRecording(true)
      startSilenceDetection()
    } catch {
      toast.error('Microphone access denied')
    }
  }

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }, [])

  const toggleRecording = () => {
    if (isRecording) stopRecording()
    else startRecording()
  }

  const handleSend = async () => {
    const question = input.trim()
    if (!question || loading) return

    setInput('')
    setChatHistory((prev) => [...prev, { role: 'user', content: question }])
    setLoading(true)

    try {
      const response = await askQuestion(question, sessionId)
      if (response.session_id) setSessionId(response.session_id)
      setChatHistory((prev) => [...prev, {
        role: 'assistant', content: response.answer, confidence: response.confidence, source: response.source,
      }])
      autoPlayAudio(response.answer)
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Something went wrong.'
      setChatHistory((prev) => [...prev, { role: 'assistant', content: errorMsg, isError: true }])
      toast.error('Failed to get response')
    } finally { setLoading(false) }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleVoiceQuestion = async (audioBlob) => {
    setLoading(true)
    setChatHistory((prev) => [...prev, { role: 'user', content: '🎤 (voice message)', isVoice: true }])

    try {
      const response = await voiceAsk(audioBlob, sessionId)
      if (response.session_id) setSessionId(response.session_id)
      setChatHistory((prev) => {
        const updated = [...prev]
        const lastUserIdx = updated.findLastIndex((m) => m.role === 'user')
        if (lastUserIdx >= 0) {
          updated[lastUserIdx] = { role: 'user', content: `🎤 "${response.transcription}"`, isVoice: true }
        }
        return [...updated, {
          role: 'assistant', content: response.answer, confidence: response.confidence, source: response.source,
        }]
      })
      autoPlayAudio(response.answer)
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Voice processing failed.'
      setChatHistory((prev) => [...prev, { role: 'assistant', content: errorMsg, isError: true }])
      toast.error('Voice processing failed')
    } finally { setLoading(false) }
  }

  const playAudio = async (text) => {
    if (isPlaying) { audioRef.current?.pause(); setIsPlaying(false); return }
    try {
      setIsPlaying(true)
      const audioBlob = await synthesizeSpeech(text)
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio
      audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(audioUrl) }
      audio.onerror = () => { setIsPlaying(false) }
      await audio.play()
    } catch { setIsPlaying(false) }
  }

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
    setIsPlaying(false)
  }

  const suggestedQuestions = [
    'How do I reset my password?',
    'How do I apply for leave?',
    'Where can I download payslips?',
    'How do I update my profile?',
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
        {chatHistory.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full animate-fade-in">
            {/* Hero 3D-style Robot Icon */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="relative mb-8"
            >
              <div className="w-24 h-24 rounded-3xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)', boxShadow: '0 0 50px rgba(99,102,241,0.3)' }}>
                <span className="text-5xl">🤖</span>
              </div>
              {/* Orbital ring effect */}
              <div className="absolute inset-0 rounded-3xl border border-primary-400/20 animate-ping" style={{ animationDuration: '3s' }} />
            </motion.div>

            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
              VoiceBOT AI Assistant
            </h2>
            <p className="text-sm text-gray-400 mb-1 font-light">
              Ask me anything about your company FAQ
            </p>
            <p className="text-xs text-gray-500 mb-10">
              💬 Type or 🎤 Speak — auto-stops when you pause
            </p>

            {/* Suggestion Cards — glass style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
              {suggestedQuestions.map((q) => (
                <motion.button
                  key={q}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setInput(q)}
                  className="glass-card-hover text-xs text-left px-4 py-3.5 text-gray-300"
                >
                  <span className="text-primary-400 mr-2">→</span>
                  {q}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <ChatMessage key={i} message={msg} onPlayAudio={playAudio} isPlaying={isPlaying} />
        ))}

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="chat-bubble-bot inline-flex items-center gap-2 px-5 py-4"
          >
            <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" />
            <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:0.15s]" style={{ background: '#a855f7' }} />
            <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:0.3s]" style={{ background: '#ec4899' }} />
          </motion.div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* --- Voice Visualizer Overlay --- */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center backdrop-blur-xl"
            style={{ background: 'rgba(8, 13, 26, 0.92)' }}
          >
            {/* Dynamic Waveform Visualizer */}
            <div className="relative mb-8">
              {/* Outer glow ring */}
              <motion.div
                animate={{
                  scale: 1 + (volumeLevel / 100) * 0.3,
                  opacity: 0.1 + (volumeLevel / 100) * 0.3,
                }}
                className="absolute inset-[-40px] rounded-full blur-2xl"
                style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
              />

              {/* Waveform bars in a circle */}
              <div className="relative w-48 h-48 flex items-center justify-center">
                {/* Center mic icon */}
                <motion.div
                  animate={{ scale: 1 + (volumeLevel / 100) * 0.15 }}
                  className="w-20 h-20 rounded-full flex items-center justify-center z-10"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', boxShadow: '0 0 50px rgba(99,102,241,0.3)' }}
                >
                  <HiMicrophone size={32} className="text-white" />
                </motion.div>

                {/* Circular wave bars */}
                {waveData.map((val, i) => {
                  const angle = (i / waveData.length) * 360
                  const height = 20 + val * 40
                  return (
                    <motion.div
                      key={i}
                      className="absolute w-1.5 rounded-full origin-bottom"
                      style={{
                        transform: `rotate(${angle}deg) translateY(-45px)`,
                        height: `${height}px`,
                        background: `linear-gradient(to top, #6366f1, #a855f7, #ec4899)`,
                        opacity: 0.5 + val * 0.5,
                      }}
                      animate={{ height }}
                      transition={{ duration: 0.05 }}
                    />
                  )
                })}
              </div>
            </div>

            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-lg font-medium text-white mb-2"
            >
              Listening...
            </motion.p>
            <p className="text-sm text-gray-400 mb-6">
              Speak now — auto-stops on silence
            </p>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={stopRecording}
              className="px-6 py-2.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-gray-300 text-sm hover:bg-white/[0.1] transition-all"
            >
              Cancel
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="border-t border-white/[0.05] px-4 md:px-8 py-4 relative">
        {/* Auto-speak toggle + playing indicator */}
        <div className="flex items-center justify-between max-w-4xl mx-auto mb-2.5">
          <button
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full transition-all duration-200 ${
              autoSpeak
                ? 'bg-primary-500/10 text-primary-400 ring-1 ring-primary-500/20'
                : 'bg-white/[0.04] text-gray-500 ring-1 ring-white/[0.06]'
            }`}
          >
            {autoSpeak ? <FiVolume2 size={11} /> : <FiVolumeX size={11} />}
            {autoSpeak ? 'Auto-speak on' : 'Auto-speak off'}
          </button>

          {isPlaying && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={stopAudio}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 ring-1 ring-red-500/20 animate-pulse"
            >
              <FiVolumeX size={11} />
              Stop speaking
            </motion.button>
          )}
        </div>

        {/* Input bar with integrated mic — glowing border */}
        <div className="max-w-4xl mx-auto">
          <div
            className={`flex items-center gap-2 p-1.5 rounded-2xl transition-all duration-300 ${
              isRecording
                ? 'bg-primary-500/5 ring-2 ring-primary-500/40'
                : 'bg-white/[0.03] ring-1 ring-white/[0.08] focus-within:ring-primary-500/30'
            }`}
            style={isRecording ? { boxShadow: '0 0 20px rgba(0,212,255,0.3), 0 0 40px rgba(168,85,247,0.15)' } : {}}
          >
            {/* Mic Button — integrated into input bar */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleRecording}
              disabled={loading}
              className={`p-3 rounded-xl transition-all duration-300 flex-shrink-0 ${
                isRecording
                  ? 'text-white'
                  : 'hover:bg-white/[0.06] text-gray-400 hover:text-primary-400'
              }`}
              style={isRecording ? { background: 'linear-gradient(135deg, #6366f1, #a855f7)', boxShadow: '0 0 30px rgba(99,102,241,0.25)' } : {}}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              <HiMicrophone size={20} />
            </motion.button>

            {/* Text Input */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type or tap mic to speak..."
              className="flex-1 bg-transparent px-2 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
              disabled={loading || isRecording}
            />

            {/* Send Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className={`p-3 rounded-xl transition-all duration-300 flex-shrink-0 ${
                input.trim()
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white'
                  : 'text-gray-500 hover:bg-white/[0.04]'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              style={input.trim() ? { boxShadow: '0 0 20px rgba(99,102,241,0.15)' } : {}}
              aria-label="Send message"
            >
              <FiSend size={17} />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatWindow
