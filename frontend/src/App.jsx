import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import UploadPanel from './components/UploadPanel'
import SettingsPanel from './components/SettingsPanel'
import Dashboard from './components/Dashboard'
import Header from './components/Header'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('chat')
  const [sessionId, setSessionId] = useState(null)
  const [chatHistory, setChatHistory] = useState([])

  const startNewChat = () => {
    setSessionId(null)
    setChatHistory([])
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <ChatWindow
            sessionId={sessionId}
            setSessionId={setSessionId}
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
          />
        )
      case 'upload':
        return <UploadPanel />
      case 'dashboard':
        return <Dashboard />
      case 'settings':
        return <SettingsPanel />
      default:
        return <ChatWindow />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden relative" style={{ background: '#080d1a' }}>
      {/* Ambient Background Glows */}
      <div className="ambient-glow top-[-200px] left-[-100px]" style={{ background: '#6366f1' }} />
      <div className="ambient-glow top-[40%] right-[-200px]" style={{ background: '#a855f7' }} />
      <div className="ambient-glow bottom-[-200px] left-[30%]" style={{ background: '#06b6d4' }} />

      <Toaster
        position="top-right"
        toastOptions={{
          className: 'glass-card text-sm text-gray-200',
          style: {
            background: 'rgba(30, 41, 59, 0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e2e8f0',
          },
        }}
      />

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewChat={startNewChat}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <Header
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          activeTab={activeTab}
        />
        <main className="flex-1 overflow-hidden">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

export default App
