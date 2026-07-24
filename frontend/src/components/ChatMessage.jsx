import { FiUser, FiVolume2 } from 'react-icons/fi'
import { HiMicrophone } from 'react-icons/hi2'
import { RiRobot2Fill } from 'react-icons/ri'
import { motion } from 'framer-motion'

function ChatMessage({ message, onPlayAudio, isPlaying }) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* Bot Avatar */}
      {!isUser && (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-primary-500/20" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', boxShadow: '0 0 20px rgba(99,102,241,0.15)' }}>
          <RiRobot2Fill className="text-white" size={16} />
        </div>
      )}

      {/* Message Content */}
      <div className={`${isUser ? 'chat-bubble-user' : 'chat-bubble-bot'} max-w-[75%]`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>

        {/* Source Citation + Play button (bot messages only) */}
        {!isUser && !message.isError && (
          <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {message.source && (
                <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                  <span className="text-primary-400">📄</span>
                  {message.source.document}
                  {message.source.page > 0 && (
                    <span className="text-gray-500">· p.{message.source.page}</span>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onPlayAudio && message.content && !message.isError && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onPlayAudio(message.content)}
                  className={`text-[11px] flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-200 ${
                    isPlaying
                      ? 'bg-primary-500/20 text-primary-300 ring-1 ring-primary-500/30'
                      : 'hover:bg-white/[0.06] text-gray-400 hover:text-gray-300'
                  }`}
                  title="Play as audio"
                >
                  <FiVolume2 size={11} />
                  <span>Play</span>
                </motion.button>
              )}

              {message.confidence !== undefined && (
                <ConfidenceBadge confidence={message.confidence} />
              )}
            </div>
          </div>
        )}

        {message.isError && (
          <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
            <span>⚠️</span> Error occurred
          </p>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-primary-500/20">
          {message.isVoice ? (
            <HiMicrophone size={14} className="text-white" />
          ) : (
            <FiUser size={14} className="text-white" />
          )}
        </div>
      )}
    </motion.div>
  )
}

function ConfidenceBadge({ confidence }) {
  let color = 'bg-red-500/10 text-red-400 ring-red-500/20'
  if (confidence >= 80) color = 'bg-green-500/10 text-green-400 ring-green-500/20'
  else if (confidence >= 50) color = 'bg-amber-500/10 text-amber-400 ring-amber-500/20'

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${color}`}>
      {confidence}%
    </span>
  )
}

export default ChatMessage
