import { useState, useRef } from 'react'
import { FiUpload, FiFile, FiCheck, FiX } from 'react-icons/fi'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { uploadFAQ } from '../services/api'

function UploadPanel() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const allowedTypes = ['.pdf', '.docx', '.txt', '.csv']

  const handleFileSelect = (e) => {
    const selected = e.target.files[0]
    if (!selected) return
    validateAndSet(selected)
  }

  const validateAndSet = (selected) => {
    const ext = '.' + selected.name.split('.').pop().toLowerCase()
    if (!allowedTypes.includes(ext)) {
      toast.error('Unsupported file type. Allowed: PDF, DOCX, TXT, CSV')
      return
    }
    setFile(selected)
    setResult(null)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setResult(null)

    try {
      const response = await uploadFAQ(file)
      setResult({ success: true, data: response })
      toast.success(`Indexed! ${response.chunks} chunks created.`)
      setFile(null)
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Upload failed'
      setResult({ success: false, error: errorMsg })
      toast.error(errorMsg)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 animate-fade-in">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center mx-auto mb-4" style={{ boxShadow: '0 0 20px rgba(99,102,241,0.15)' }}>
            <FiUpload className="text-white" size={24} />
          </div>
          <h2 className="text-xl font-bold text-white">Upload FAQ Document</h2>
          <p className="text-sm text-gray-400 mt-1">
            Index your documents for AI-powered search
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDrop={(e) => { e.preventDefault(); setDragOver(false); validateAndSet(e.dataTransfer.files[0]) }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`card-hover cursor-pointer p-10 text-center transition-all duration-200 ${
            dragOver ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/10 scale-[1.01]' : ''
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3">
            <FiUpload className="text-gray-400" size={22} />
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Drag & drop or click to browse
          </p>
          <p className="text-xs text-gray-400">
            PDF · DOCX · TXT · CSV (max 100MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Selected File */}
        {file && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 card flex items-center gap-3 p-4"
          >
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <FiFile className="text-primary-500" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-200">
                {file.name}
              </p>
              <p className="text-xs text-gray-400">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button onClick={() => setFile(null)} className="btn-ghost p-1.5">
              <FiX size={16} />
            </button>
          </motion.div>
        )}

        {/* Upload Button */}
        {file && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleUpload}
            disabled={uploading}
            className="w-full btn-primary mt-4 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing & Indexing...
              </>
            ) : (
              <>
                <FiUpload size={15} />
                Upload & Index
              </>
            )}
          </motion.button>
        )}

        {/* Result */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 p-4 rounded-xl border ${
              result.success
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
            }`}
          >
            {result.success ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <FiCheck className="text-green-600 dark:text-green-400" size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    Indexed Successfully
                  </p>
                  <p className="text-xs text-green-600/70 dark:text-green-400/70">
                    {result.data.chunks} chunks created & stored
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <FiX className="text-red-600 dark:text-red-400" size={16} />
                </div>
                <p className="text-sm text-red-700 dark:text-red-300">{result.error}</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default UploadPanel
