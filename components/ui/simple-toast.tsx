'use client'
import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

type Toast = { id: string; text: string }

const ToastCtx = React.createContext<{ push: (text: string) => void } | null>(null)

export function useSimpleToast() {
  const ctx = React.useContext(ToastCtx)
  if (!ctx) throw new Error('SimpleToastProvider missing')
  return ctx
}

export function SimpleToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const push = (text: string) => {
    const t = { id: crypto.randomUUID(), text }
    setToasts((s) => [...s, t])
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== t.id)), 3500)
  }

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}

      {/* Toast container */}
      <div className="fixed inset-x-0 top-6 z-[9999] flex flex-col items-center space-y-3 sm:top-8">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="group relative flex max-w-md items-center justify-between rounded-lg border border-border bg-background/90 px-4 py-3 text-sm shadow-xl backdrop-blur-lg ring-1 ring-border"
            >
              <span className="text-foreground font-medium">{t.text}</span>
              <button
                onClick={() => setToasts((s) => s.filter((x) => x.id !== t.id))}
                className="ml-3 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              <motion.div
                layoutId="toast-glow"
                className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}
