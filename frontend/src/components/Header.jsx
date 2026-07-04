import { FiMenu, FiSun, FiMoon } from 'react-icons/fi'
import { RiRobot2Fill } from 'react-icons/ri'
import { useTheme } from '../context/ThemeContext'
import { motion } from 'framer-motion'

function Header({ toggleSidebar, activeTab }) {
  const { darkMode, toggleTheme } = useTheme()

  const titles = {
    chat: 'Chat',
    upload: 'Upload FAQ',
    dashboard: 'Analytics',
    settings: 'Settings',
  }

  return (
    <header className="glass border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="btn-ghost"
          aria-label="Toggle sidebar"
        >
          <FiMenu size={20} />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow">
            <RiRobot2Fill className="text-white" size={18} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
              PeopleXM AI
            </h1>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
              {titles[activeTab]}
            </p>
          </div>
        </div>
      </div>

      {/* Dark Mode Toggle */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={toggleTheme}
        className="relative w-14 h-7 rounded-full bg-gray-200 dark:bg-gray-700 p-1 transition-colors duration-300"
        aria-label="Toggle dark mode"
      >
        <motion.div
          className="w-5 h-5 rounded-full bg-white dark:bg-primary-500 shadow-md flex items-center justify-center"
          animate={{ x: darkMode ? 26 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          {darkMode ? (
            <FiMoon size={11} className="text-white" />
          ) : (
            <FiSun size={11} className="text-yellow-500" />
          )}
        </motion.div>
      </motion.button>
    </header>
  )
}

export default Header
