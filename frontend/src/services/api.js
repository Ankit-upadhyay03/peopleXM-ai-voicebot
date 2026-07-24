import axios from 'axios'

const API_BASE = '/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * POST /api/ask — Ask a text question to the FAQ bot
 */
export const askQuestion = async (question, sessionId = null) => {
  const payload = { question }
  if (sessionId) payload.session_id = sessionId

  const response = await api.post('/ask', payload)
  return response.data
}

/**
 * POST /api/upload/upload-faq — Upload a FAQ document
 */
export const uploadFAQ = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post('/upload/upload-faq', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

/**
 * POST /api/voice/transcribe — Speech to text (Whisper)
 */
export const transcribeAudio = async (audioBlob, language = 'en') => {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'recording.webm')
  formData.append('language', language)

  const response = await api.post('/voice/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

/**
 * POST /api/voice/synthesize — Text to speech (ElevenLabs)
 * Returns audio blob
 */
export const synthesizeSpeech = async (text) => {
  const formData = new FormData()
  formData.append('text', text)

  const response = await api.post('/voice/synthesize', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob',
  })
  return response.data
}

/**
 * POST /api/voice/ask — Full voice pipeline (audio in → answer + audio out)
 */
export const voiceAsk = async (audioBlob, sessionId = null, language = 'en') => {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'recording.webm')
  formData.append('language', language)
  if (sessionId) formData.append('session_id', sessionId)

  const response = await api.post('/voice/ask', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

/**
 * GET /api/health — Health check
 */
export const healthCheck = async () => {
  const response = await api.get('/health/')
  return response.data
}

/**
 * GET /api/analytics — One-shot analytics fetch
 */
export const getAnalytics = async () => {
  const response = await api.get('/analytics/')
  return response.data
}

/**
 * Create an EventSource for real-time analytics streaming (SSE).
 * Returns the EventSource instance — caller must close it on unmount.
 *
 * @param {function} onUpdate - Callback receiving the analytics data object
 * @returns {EventSource}
 */
export const createAnalyticsStream = (onUpdate) => {
  const url = `${window.location.origin}${API_BASE}/analytics/stream`
  const eventSource = new EventSource(url)

  eventSource.addEventListener('analytics_update', (event) => {
    try {
      const data = JSON.parse(event.data)
      onUpdate(data)
    } catch (e) {
      console.error('Failed to parse analytics event:', e)
    }
  })

  eventSource.onerror = () => {
    // EventSource auto-reconnects on error
    console.warn('Analytics SSE connection error, will auto-reconnect')
  }

  return eventSource
}

export default api
