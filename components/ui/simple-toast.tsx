'use client'
import * as React from 'react'

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
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== t.id)), 3000)
  }
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto rounded-md border bg-background px-3 py-2 text-sm shadow">
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
