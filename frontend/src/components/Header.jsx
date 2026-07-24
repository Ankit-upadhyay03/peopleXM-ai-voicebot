import { FiMenu } from 'react-icons/fi'
import { RiRobot2Fill } from 'react-icons/ri'
import { motion } from 'framer-motion'

function Header({ toggleSidebar, activeTab }) {
  const titles = {
    chat: 'Chat',
    upload: 'Upload FAQ',
    dashboard: 'Analytics',
    settings: 'Settings',
  }

  return (
    <header className="glass-header px-5 py-3.5 flex items-center justify-between z-10">
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleSidebar}
          className="btn-ghost"
          aria-label="Toggle sidebar"
        >
          <FiMenu size={19} />
        </motion.button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center animate-glow-pulse" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)' }}>
            <RiRobot2Fill className="text-white" size={16} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight tracking-tight">
              VoiceBOT
            </h1>
            <p className="text-[10px] text-gray-400 leading-tight font-medium">
              {titles[activeTab]}
            </p>
          </div>
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Active
        </span>
      </div>
    </header>
  )
}

export default Header
