'use client'

import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

export default function FullPageLoader() {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-white text-gray-800">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center space-y-4"
      >
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm font-medium">Loading RemoteHub...</p>
      </motion.div>
    </div>
  )
}
