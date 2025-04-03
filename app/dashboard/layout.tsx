import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-white to-slate-50">
      <div
        className={cn(
          'max-w-7xl mx-auto px-6 md:px-10 py-8',
          'flex flex-col gap-6'
        )}
      >
        {children}
      </div>
    </main>
  )
}
