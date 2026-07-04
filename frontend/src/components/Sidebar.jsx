import { FiMessageSquare, FiUpload, FiSettings, FiPlus, FiBarChart2 } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'

function Sidebar({ isOpen, activeTab, setActiveTab, onNewChat }) {
  const menuItems = [
    { id: 'chat', label: 'Chat', icon: <FiMessageSquare size={18} /> },
    { id: 'upload', label: 'Upload FAQ', icon: <FiUpload size={18} /> },
    { id: 'dashboard', label: 'Analytics', icon: <FiBarChart2 size={18} /> },
    { id: 'settings', label: 'Settings', icon: <FiSettings size={18} /> },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 260, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="h-full bg-white dark:bg-[#1e293b] border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden"
        >
          {/* Logo Area */}
          <div className="p-4 pb-2">
            <div className="flex items-center gap-2 mb-4 px-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <span className="text-white text-xs font-bold">PX</span>
              </div>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                PeopleXM
              </span>
            </div>

            {/* New Chat Button */}
            <button
              onClick={onNewChat}
              className="w-full flex items-center gap-2 btn-primary justify-center text-sm"
            >
              <FiPlus size={15} />
              New Chat
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-2 space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`sidebar-item ${
                  activeTab === item.id ? 'sidebar-item-active' : 'sidebar-item-inactive'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {activeTab === item.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute left-0 w-1 h-6 bg-primary-500 rounded-r-full"
                  />
                )}
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 px-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                <span className="text-white text-xs font-medium">A</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  Admin User
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  v1.0.0
                </p>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

export default Sidebar
