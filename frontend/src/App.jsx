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
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#0f172a]">
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'card text-sm',
          style: { background: undefined, color: undefined },
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
      <div className="flex-1 flex flex-col overflow-hidden">
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
