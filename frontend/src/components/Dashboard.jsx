import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiMessageSquare,
  FiClock,
  FiTrendingUp,
  FiAlertCircle,
  FiActivity,
  FiTarget,
} from 'react-icons/fi'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { createAnalyticsStream } from '../services/api'

// --- Animated Counter Hook (smooth number transitions) ---
function useAnimatedCounter(target, duration = 800) {
  const [count, setCount] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const start = prevRef.current
    prevRef.current = target
    const diff = target - start
    if (diff === 0) { setCount(target); return }

    const startTime = performance.now()
    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(start + diff * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [target, duration])

  return count
}

// --- Animated Stat Card ---
function StatCard({ stat, index }) {
  const animatedValue = useAnimatedCounter(stat.rawValue)
  const [flash, setFlash] = useState(false)
  const prevValue = useRef(stat.rawValue)

  useEffect(() => {
    if (prevValue.current !== stat.rawValue) {
      setFlash(true)
      prevValue.current = stat.rawValue
      const t = setTimeout(() => setFlash(false), 600)
      return () => clearTimeout(t)
    }
  }, [stat.rawValue])

  const displayValue = stat.format ? stat.format(animatedValue) : animatedValue.toLocaleString()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="stat-card relative overflow-hidden"
    >
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 rounded-2xl"
            style={{ boxShadow: `inset 0 0 20px ${stat.glowColor}` }}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ background: stat.gradient }}
        >
          {stat.icon}
        </div>
        {stat.change !== null && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            stat.changePositive
              ? 'text-green-400 bg-green-500/10 ring-1 ring-green-500/20'
              : 'text-red-400 bg-red-500/10 ring-1 ring-red-500/20'
          }`}>
            {stat.change}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white tracking-tight tabular-nums">
        {displayValue}
      </p>
      <p className="text-[11px] text-gray-400 mt-0.5">{stat.label}</p>
    </motion.div>
  )
}

// --- Custom Dark Tooltip ---
function CustomTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="px-3 py-2 rounded-xl text-xs" style={{
      background: 'rgba(15, 23, 42, 0.95)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="text-white font-semibold">{payload[0].value}{suffix}</p>
    </div>
  )
}

// --- Main Dashboard ---
function Dashboard() {
  const [analytics, setAnalytics] = useState(null)
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef(null)

  // Connect to SSE stream on mount
  useEffect(() => {
    const es = createAnalyticsStream((data) => {
      setAnalytics(data)
      setConnected(true)
    })
    eventSourceRef.current = es

    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [])

  // Zeroed initial state while waiting for first SSE event
  const data = analytics || {
    totalQuestions: 0,
    avgConfidence: 0,
    failedQueries: 0,
    todayUsage: 0,
    successRate: 0,
    avgResponseTime: 0,
    hourlyTraffic: [],
    weeklyVolume: [],
    topQuestions: [],
    confidenceDistribution: [
      { name: 'High (80-100%)', value: 0, color: '#10b981' },
      { name: 'Medium (50-79%)', value: 0, color: '#f59e0b' },
      { name: 'Low (0-49%)', value: 0, color: '#ef4444' },
    ],
  }

  const statCards = [
    {
      label: 'Total Questions',
      rawValue: data.totalQuestions,
      format: (v) => v.toLocaleString(),
      icon: <FiMessageSquare size={18} />,
      gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)',
      glowColor: 'rgba(99, 102, 241, 0.3)',
      change: data.totalQuestions > 0 ? `${data.totalQuestions}` : null,
      changePositive: true,
    },
    {
      label: 'Avg Response Time',
      rawValue: Math.round(data.avgResponseTime * 10),
      format: (v) => `${(v / 10).toFixed(1)}s`,
      icon: <FiClock size={18} />,
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
      glowColor: 'rgba(16, 185, 129, 0.3)',
      change: data.avgResponseTime > 0 ? `${data.avgResponseTime.toFixed(1)}s` : null,
      changePositive: true,
    },
    {
      label: 'Avg Confidence',
      rawValue: Math.round(data.avgConfidence),
      format: (v) => `${v}%`,
      icon: <FiTarget size={18} />,
      gradient: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
      glowColor: 'rgba(139, 92, 246, 0.3)',
      change: data.avgConfidence > 0 ? `${Math.round(data.avgConfidence)}%` : null,
      changePositive: data.avgConfidence >= 70,
    },
    {
      label: 'Failed Queries',
      rawValue: data.failedQueries,
      icon: <FiAlertCircle size={18} />,
      gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
      glowColor: 'rgba(239, 68, 68, 0.3)',
      change: data.failedQueries > 0 ? `${data.failedQueries}` : null,
      changePositive: false,
    },
    {
      label: "Today's Usage",
      rawValue: data.todayUsage,
      icon: <FiActivity size={18} />,
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      glowColor: 'rgba(245, 158, 11, 0.3)',
      change: data.todayUsage > 0 ? `${data.todayUsage}` : null,
      changePositive: true,
    },
    {
      label: 'Success Rate',
      rawValue: Math.round(data.successRate * 10),
      format: (v) => `${(v / 10).toFixed(1)}%`,
      icon: <FiTrendingUp size={18} />,
      gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
      glowColor: 'rgba(6, 182, 212, 0.3)',
      change: data.successRate > 0 ? `${data.successRate.toFixed(1)}%` : null,
      changePositive: data.successRate >= 90,
    },
  ]

  const chartGrid = 'rgba(99, 102, 241, 0.06)'
  const chartText = '#64748b'

  return (
    <div className="h-full overflow-y-auto px-4 md:px-8 py-6 space-y-6 animate-fade-in">
      {/* Page Title + LIVE indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Analytics Dashboard
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Real-time metrics from MongoDB
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{
          background: connected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          border: `1px solid ${connected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
        }}>
          <span className="relative flex h-2.5 w-2.5">
            {connected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          </span>
          <span className={`text-[11px] font-semibold tracking-wide ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, i) => (
          <StatCard key={stat.label} stat={stat} index={i} />
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Bar Chart — Weekly Usage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="stat-card lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-200">Weekly Query Volume</h3>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
              Live
            </div>
          </div>
          {data.weeklyVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.weeklyVolume} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: chartText, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chartText, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip suffix=" queries" />} />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <Bar dataKey="queries" fill="url(#barGrad)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-500 text-sm">
              No data yet — ask a question to see metrics
            </div>
          )}
        </motion.div>

        {/* Donut Chart — Confidence Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="stat-card"
        >
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Confidence Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <defs>
                <linearGradient id="greenG" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="amberG" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
                <linearGradient id="redG" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f87171" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
              </defs>
              <Pie
                data={data.confidenceDistribution}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={4}
                dataKey="value"
                animationDuration={600}
              >
                <Cell fill="url(#greenG)" />
                <Cell fill="url(#amberG)" />
                <Cell fill="url(#redG)" />
              </Pie>
              <Tooltip content={<CustomTooltip suffix="%" />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {data.confidenceDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-[11px]">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-gray-400 flex-1">{item.name}</span>
                <span className="font-semibold text-gray-200 tabular-nums">{item.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Top Asked Questions — full width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="stat-card lg:col-span-3"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-200">Top Asked Questions</h3>
            <span className="text-[10px] text-primary-400 font-medium">Live Ranking</span>
          </div>
          {data.topQuestions.length > 0 ? (
            <div className="space-y-3">
              {data.topQuestions.map((item, i) => (
                <motion.div
                  key={item.question}
                  layout
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="flex items-center gap-3"
                >
                  <span className={`text-[11px] font-bold w-4 text-center ${
                    i === 0 ? 'text-primary-400' : 'text-gray-500'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-300 truncate mb-1">{item.question}</p>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, #6366f1, #a855f7)' }}
                        animate={{ width: `${data.topQuestions[0]?.count ? (item.count / data.topQuestions[0].count) * 100 : 0}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-gray-300 tabular-nums w-8 text-right">
                    {item.count}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-gray-500 text-sm">
              No questions asked yet
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard
