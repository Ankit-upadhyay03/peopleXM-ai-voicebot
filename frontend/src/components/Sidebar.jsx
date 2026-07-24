import { FiMessageSquare, FiUpload, FiSettings, FiPlus, FiBarChart2, FiClock, FiShield } from 'react-icons/fi'
import { RiRobot2Fill } from 'react-icons/ri'
import { motion, AnimatePresence } from 'framer-motion'

function Sidebar({ isOpen, activeTab, setActiveTab, onNewChat }) {
  const menuItems = [
    { id: 'chat', label: 'Chat', icon: <FiMessageSquare size={17} /> },
    { id: 'upload', label: 'Upload FAQ', icon: <FiUpload size={17} /> },
    { id: 'dashboard', label: 'Analytics', icon: <FiBarChart2 size={17} /> },
    { id: 'settings', label: 'Settings', icon: <FiShield size={17} /> },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 260, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="h-full backdrop-blur-xl border-r border-white/[0.06] flex flex-col overflow-hidden relative"
          style={{ background: 'rgba(8, 13, 26, 0.8)' }}
        >
          {/* Subtle gradient overlay at top */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary-500/[0.03] to-transparent pointer-events-none" />

          {/* Logo Area */}
          <div className="p-5 pb-3 relative">
            <div className="flex items-center gap-3 mb-5 px-1">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
                <RiRobot2Fill className="text-white" size={18} />
              </div>
              <div>
                <span className="text-sm font-bold text-white tracking-tight">
                  VoiceBOT
                </span>
                <span className="text-[10px] text-primary-400 block -mt-0.5 font-medium">
                  AI Assistant
                </span>
              </div>
            </div>

            {/* New Chat Button — glowing pill */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onNewChat}
              className="w-full flex items-center gap-2.5 btn-primary justify-center text-sm"
            >
              <FiPlus size={15} />
              New Chat
            </motion.button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-3 space-y-1">
            {menuItems.map((item) => (
              <motion.button
                key={item.id}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(item.id)}
                className={`sidebar-item ${
                  activeTab === item.id ? 'sidebar-item-active' : 'sidebar-item-inactive'
                }`}
              >
                <span className={activeTab === item.id ? 'text-primary-400' : ''}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {activeTab === item.id && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 w-[3px] h-5 rounded-r-full"
                    style={{ background: 'linear-gradient(to bottom, #818cf8, #a855f7)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.button>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/[0.05]">
            <div className="flex items-center gap-2.5 px-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center ring-2 ring-primary-500/20" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
                <span className="text-white text-xs font-semibold">A</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-300 truncate">
                  Admin User
                </p>
                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Online
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
