import { FiUser, FiVolume2 } from 'react-icons/fi'
import { HiMicrophone } from 'react-icons/hi2'
import { RiRobot2Fill } from 'react-icons/ri'
import { motion } from 'framer-motion'

function ChatMessage({ message, onPlayAudio, isPlaying }) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* Bot Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <RiRobot2Fill className="text-white" size={15} />
        </div>
      )}

      {/* Message Content */}
      <div className={`${isUser ? 'chat-bubble-user' : 'chat-bubble-bot'} max-w-[80%]`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>

        {/* Source Citation + Play button (bot messages only) */}
        {!isUser && !message.isError && (
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {/* Source */}
              {message.source && (
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span>📄</span>
                  {message.source.document}
                  {message.source.page > 0 && (
                    <span className="text-gray-400 dark:text-gray-500">
                      · p.{message.source.page}
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Play Audio Button */}
              {onPlayAudio && message.content && !message.isError && (
                <button
                  onClick={() => onPlayAudio(message.content)}
                  className={`text-xs flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${
                    isPlaying
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400'
                  }`}
                  title="Play as audio"
                >
                  <FiVolume2 size={12} />
                  <span>Play</span>
                </button>
              )}

              {/* Confidence Badge */}
              {message.confidence !== undefined && (
                <ConfidenceBadge confidence={message.confidence} />
              )}
            </div>
          </div>
        )}

        {message.isError && (
          <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
            <span>⚠️</span> Error occurred
          </p>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-primary-500 flex items-center justify-center flex-shrink-0 shadow-sm">
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
  let color = 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
  if (confidence >= 80) color = 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
  else if (confidence >= 50) color = 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'

  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {confidence}%
    </span>
  )
}

export default ChatMessage
