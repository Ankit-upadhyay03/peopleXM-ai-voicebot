import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useTheme } from '../context/ThemeContext'

// Mock analytics data (would come from /api/logs in production)
const mockStats = {
  totalQuestions: 1247,
  avgResponseTime: '1.2s',
  avgConfidence: 82,
  failedQueries: 43,
  todayUsage: 89,
  successRate: 96.5,
}

const topQuestions = [
  { question: 'How do I reset my password?', count: 156 },
  { question: 'How do I apply for leave?', count: 134 },
  { question: 'Where can I download payslips?', count: 98 },
  { question: 'How do I update my profile?', count: 87 },
  { question: 'What is the WFH policy?', count: 72 },
]

const weeklyUsage = [
  { day: 'Mon', queries: 145 },
  { day: 'Tue', queries: 189 },
  { day: 'Wed', queries: 167 },
  { day: 'Thu', queries: 210 },
  { day: 'Fri', queries: 178 },
  { day: 'Sat', queries: 45 },
  { day: 'Sun', queries: 32 },
]

const confidenceDistribution = [
  { name: 'High (80-100%)', value: 68, color: '#10b981' },
  { name: 'Medium (50-79%)', value: 22, color: '#f59e0b' },
  { name: 'Low (0-49%)', value: 10, color: '#ef4444' },
]

const hourlyTraffic = [
  { hour: '6AM', queries: 5 },
  { hour: '8AM', queries: 22 },
  { hour: '9AM', queries: 45 },
  { hour: '10AM', queries: 62 },
  { hour: '11AM', queries: 58 },
  { hour: '12PM', queries: 35 },
  { hour: '1PM', queries: 40 },
  { hour: '2PM', queries: 55 },
  { hour: '3PM', queries: 48 },
  { hour: '4PM', queries: 42 },
  { hour: '5PM', queries: 30 },
  { hour: '6PM', queries: 15 },
]

function Dashboard() {
  const { darkMode } = useTheme()

  const chartColors = {
    primary: '#6366f1',
    secondary: '#06b6d4',
    grid: darkMode ? '#334155' : '#e2e8f0',
    text: darkMode ? '#94a3b8' : '#64748b',
    bg: darkMode ? '#1e293b' : '#ffffff',
  }

  const statCards = [
    {
      label: 'Total Questions',
      value: mockStats.totalQuestions.toLocaleString(),
      icon: <FiMessageSquare size={20} />,
      color: 'from-blue-500 to-blue-600',
      change: '+12%',
    },
    {
      label: 'Avg Response Time',
      value: mockStats.avgResponseTime,
      icon: <FiClock size={20} />,
      color: 'from-green-500 to-green-600',
      change: '-0.3s',
    },
    {
      label: 'Avg Confidence',
      value: `${mockStats.avgConfidence}%`,
      icon: <FiTarget size={20} />,
      color: 'from-purple-500 to-purple-600',
      change: '+5%',
    },
    {
      label: 'Failed Queries',
      value: mockStats.failedQueries,
      icon: <FiAlertCircle size={20} />,
      color: 'from-red-500 to-red-600',
      change: '-8%',
    },
    {
      label: "Today's Usage",
      value: mockStats.todayUsage,
      icon: <FiActivity size={20} />,
      color: 'from-amber-500 to-amber-600',
      change: '+24%',
    },
    {
      label: 'Success Rate',
      value: `${mockStats.successRate}%`,
      icon: <FiTrendingUp size={20} />,
      color: 'from-cyan-500 to-cyan-600',
      change: '+1.2%',
    },
  ]

  return (
    <div className="h-full overflow-y-auto px-4 md:px-8 py-6 space-y-6 animate-fade-in">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Analytics Dashboard
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Monitor your AI assistant performance and usage
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="stat-card"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-sm`}>
                {stat.icon}
              </div>
              <span className="text-[11px] font-medium text-green-500 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-full">
                {stat.change}
              </span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {stat.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {stat.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart — Weekly Usage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-5 lg:col-span-2"
        >
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Weekly Query Volume
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weeklyUsage}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="day" tick={{ fill: chartColors.text, fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: chartColors.text, fontSize: 12 }} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: chartColors.bg,
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                }}
              />
              <Bar dataKey="queries" fill={chartColors.primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Pie Chart — Confidence Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-5"
        >
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Confidence Distribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={confidenceDistribution}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
              >
                {confidenceDistribution.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: chartColors.bg,
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {confidenceDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-gray-600 dark:text-gray-400">{item.name}</span>
                <span className="ml-auto font-medium text-gray-800 dark:text-gray-200">
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart — Hourly Traffic */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="card p-5 lg:col-span-2"
        >
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Today's Hourly Traffic
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={hourlyTraffic}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="hour" tick={{ fill: chartColors.text, fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: chartColors.text, fontSize: 11 }} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: chartColors.bg,
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                }}
              />
              <Line
                type="monotone"
                dataKey="queries"
                stroke={chartColors.primary}
                strokeWidth={2.5}
                dot={{ r: 3, fill: chartColors.primary }}
                activeDot={{ r: 5, fill: chartColors.primary }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top Asked Questions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-5"
        >
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Top Asked Questions
          </h3>
          <div className="space-y-3">
            {topQuestions.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-4">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
                    {item.question}
                  </p>
                  <div className="mt-1 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full"
                      style={{ width: `${(item.count / topQuestions[0].count) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard
