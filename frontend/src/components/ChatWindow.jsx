import { useState, useRef, useEffect } from 'react'
import { FiSend, FiVolume2, FiVolumeX } from 'react-icons/fi'
import { HiMicrophone, HiStop } from 'react-icons/hi2'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { askQuestion, voiceAsk, synthesizeSpeech } from '../services/api'
import ChatMessage from './ChatMessage'

function ChatWindow({ sessionId, setSessionId, chatHistory, setChatHistory }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true) // Auto-speak responses
  const chatEndRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // --- Auto-speak: plays audio for the latest bot response ---
  const autoPlayAudio = async (text) => {
    if (!autoSpeak || !text) return

    try {
      setIsPlaying(true)
      const audioBlob = await synthesizeSpeech(text)
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setIsPlaying(false)
        URL.revokeObjectURL(audioUrl)
      }
      audio.onerror = () => {
        setIsPlaying(false)
      }

      await audio.play()
    } catch {
      setIsPlaying(false)
    }
  }

  // --- Text Chat (also auto-speaks response) ---
  const handleSend = async () => {
    const question = input.trim()
    if (!question || loading) return

    setInput('')
    setChatHistory((prev) => [...prev, { role: 'user', content: question }])
    setLoading(true)

    try {
      const response = await askQuestion(question, sessionId)
      if (response.session_id) setSessionId(response.session_id)

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          confidence: response.confidence,
          source: response.source,
        },
      ])

      // Auto-speak the response
      autoPlayAudio(response.answer)
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Something went wrong.'
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: errorMsg, isError: true },
      ])
      toast.error('Failed to get response')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // --- Voice Recording ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await handleVoiceQuestion(audioBlob)
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      toast('🎤 Recording... Click again to stop', { duration: 2000 })
    } catch {
      toast.error('Microphone access denied')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // --- Full Voice Pipeline (auto-speaks response) ---
  const handleVoiceQuestion = async (audioBlob) => {
    setLoading(true)
    setChatHistory((prev) => [...prev, { role: 'user', content: '🎤 (voice message)', isVoice: true }])

    try {
      const response = await voiceAsk(audioBlob, sessionId)
      if (response.session_id) setSessionId(response.session_id)

      // Update user message with transcription + add bot response
      setChatHistory((prev) => {
        const updated = [...prev]
        const lastUserIdx = updated.findLastIndex((m) => m.role === 'user')
        if (lastUserIdx >= 0) {
          updated[lastUserIdx] = {
            role: 'user',
            content: `🎤 "${response.transcription}"`,
            isVoice: true,
          }
        }
        return [
          ...updated,
          {
            role: 'assistant',
            content: response.answer,
            confidence: response.confidence,
            source: response.source,
          },
        ]
      })

      // Auto-speak the response
      autoPlayAudio(response.answer)
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Voice processing failed.'
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: errorMsg, isError: true },
      ])
      toast.error('Voice processing failed')
    } finally {
      setLoading(false)
    }
  }

  // --- Manual Play Audio (click play button) ---
  const playAudio = async (text) => {
    if (isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
      return
    }

    try {
      setIsPlaying(true)
      const audioBlob = await synthesizeSpeech(text)
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setIsPlaying(false)
        URL.revokeObjectURL(audioUrl)
      }
      audio.onerror = () => {
        setIsPlaying(false)
        toast.error('Audio playback failed')
      }

      await audio.play()
    } catch {
      setIsPlaying(false)
      toast.error('Speech synthesis failed')
    }
  }

  // --- Stop audio ---
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
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
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center shadow-glow-lg mb-5">
              <span className="text-3xl">🤖</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">
              PeopleXM AI Assistant
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Ask me anything about your company FAQ
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-8">
              💬 Type or 🎤 Speak — responses are spoken automatically
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-lg w-full">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="card-hover text-xs text-left px-4 py-3 text-gray-600 dark:text-gray-300"
                >
                  <span className="text-primary-500 mr-1.5">→</span>
                  {q}
                </button>
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
            className="chat-bubble-bot inline-flex items-center gap-1.5"
          >
            <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce [animation-delay:0.1s]" />
            <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce [animation-delay:0.2s]" />
          </motion.div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-800 px-4 md:px-8 py-4">
        {/* Auto-speak toggle + playing indicator */}
        <div className="flex items-center justify-between max-w-4xl mx-auto mb-2">
          <button
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors ${
              autoSpeak
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
            }`}
          >
            {autoSpeak ? <FiVolume2 size={12} /> : <FiVolumeX size={12} />}
            {autoSpeak ? 'Auto-speak on' : 'Auto-speak off'}
          </button>

          {isPlaying && (
            <button
              onClick={stopAudio}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse"
            >
              <FiVolumeX size={12} />
              Stop speaking
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 max-w-4xl mx-auto">
          {/* Mic Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleRecording}
            disabled={loading}
            className={`p-3 rounded-xl transition-all duration-200 ${
              isRecording
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/25 animate-pulse'
                : 'btn-ghost'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? <HiStop size={20} /> : <HiMicrophone size={20} />}
          </motion.button>

          {/* Text Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? 'Recording... click mic to stop' : 'Type your question...'}
            className="input-field flex-1"
            disabled={loading || isRecording}
          />

          {/* Send Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="btn-primary p-3 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <FiSend size={17} />
          </motion.button>
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-xs text-red-400 mt-2 animate-pulse"
          >
            ● Recording in progress...
          </motion.p>
        )}
      </div>
    </div>
  )
}

export default ChatWindow
