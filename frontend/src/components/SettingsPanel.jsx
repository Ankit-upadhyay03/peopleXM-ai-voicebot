import { useState, useEffect } from 'react'
import { FiCheck, FiRefreshCw, FiServer, FiCpu, FiDatabase, FiFileText } from 'react-icons/fi'
import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { healthCheck } from '../services/api'

function SettingsPanel() {
  const { darkMode, toggleTheme } = useTheme()
  const [backendStatus, setBackendStatus] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    checkBackend()
  }, [])

  const checkBackend = async () => {
    setChecking(true)
    try {
      await healthCheck()
      setBackendStatus(true)
    } catch {
      setBackendStatus(false)
    } finally {
      setChecking(false)
    }
  }

  const systemInfo = [
    { icon: <FiCpu size={16} />, label: 'Embedding Model', value: 'all-mpnet-base-v2 (768d)' },
    { icon: <FiCpu size={16} />, label: 'Re-ranker', value: 'ms-marco-MiniLM-L-6-v2' },
    { icon: <FiServer size={16} />, label: 'LLM', value: 'GPT-3.5 Turbo' },
    { icon: <FiDatabase size={16} />, label: 'Vector DB', value: 'ChromaDB (Persistent)' },
    { icon: <FiDatabase size={16} />, label: 'Logs DB', value: 'MongoDB Atlas' },
    { icon: <FiFileText size={16} />, label: 'Supported Files', value: 'PDF, DOCX, TXT, CSV' },
  ]

  return (
    <div className="h-full overflow-y-auto px-4 md:px-8 py-6 animate-fade-in">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            System configuration and preferences
          </p>
        </div>

        {/* Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5"
        >
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Appearance
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark Mode</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Toggle between light and dark theme
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                darkMode ? 'bg-primary-500' : 'bg-gray-300'
              }`}
            >
              <motion.div
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
                animate={{ x: darkMode ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </motion.div>

        {/* Backend Status */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Backend Status
            </h3>
            <button
              onClick={checkBackend}
              disabled={checking}
              className="btn-ghost p-1.5"
            >
              <FiRefreshCw size={14} className={checking ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              checking ? 'bg-yellow-400 animate-pulse' :
              backendStatus ? 'bg-green-400' : 'bg-red-400'
            }`} />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {checking ? 'Checking...' : backendStatus ? 'Connected (localhost:8000)' : 'Disconnected'}
            </span>
          </div>
        </motion.div>

        {/* System Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-5"
        >
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
            System Configuration
          </h3>
          <div className="space-y-3">
            {systemInfo.map((info) => (
              <div key={info.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  {info.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{info.label}</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {info.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default SettingsPanel
