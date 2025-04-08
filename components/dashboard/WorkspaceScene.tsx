'use client'

import { useUser, useOrganization } from '@clerk/nextjs'
import { Rocket, FileText, Video } from 'lucide-react'
import { motion } from 'framer-motion'

const mockPresence = [
  { name: 'Laksh', activity: 'Editing Docs' },
  { name: 'Sarah', activity: 'In a Meeting' },
  { name: 'Mike', activity: 'Browsing Tasks' },
]

export default function WorkspaceScene() {
  const { user } = useUser()
  const { organization } = useOrganization()

  return (
    <section className="w-full py-28 relative z-10 isolate overflow-hidden">
      {/* Subtle blur & shapes */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-100/30 via-transparent to-transparent dark:from-indigo-900/10 z-0 blur-2xl" />

      {/* Main content */}
      <div className="relative z-10 px-6 md:px-12 max-w-7xl mx-auto space-y-8">
        <motion.h1
          className="text-4xl md:text-6xl font-bold tracking-tight leading-snug"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {getGreeting()}, {user?.firstName ?? 'Friend'} 👋
        </motion.h1>

        <p className="text-muted-foreground max-w-md text-lg">
          Welcome back to <strong>{organization?.name ?? 'RemoteHub'}</strong>. Let’s get into your flow.
        </p>

        <motion.div className="flex flex-wrap gap-3 pt-4">
          {mockPresence.map((person, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-2 px-4 py-1.5 bg-white/70 dark:bg-zinc-800/80 rounded-full shadow-sm text-sm backdrop-blur"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 }}
            >
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>{person.name}</span>
              <span className="text-muted-foreground text-xs">· {person.activity}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Actions */}
        <motion.div
          className="flex gap-3 pt-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <CTA icon={<FileText className="w-4 h-4" />} label="New Doc" />
          <CTA icon={<Video className="w-4 h-4" />} label="Join Call" />
          <CTA icon={<Rocket className="w-4 h-4" />} label="Whiteboard" />
        </motion.div>
      </div>
    </section>
  )
}

function CTA({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center gap-2 bg-black text-white px-5 py-2 rounded-full text-sm hover:bg-zinc-800 transition shadow-lg">
      {icon}
      {label}
    </button>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
