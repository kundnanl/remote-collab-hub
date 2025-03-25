'use client'

import { motion } from 'framer-motion'
import { Briefcase, PencilRuler, BarChart } from 'lucide-react'
import clsx from 'clsx'

const steps = [
  {
    icon: Briefcase,
    title: 'Create Your Team Space',
    description: 'Set up your organization and invite your remote team to start collaborating instantly.',
  },
  {
    icon: PencilRuler,
    title: 'Collaborate in Real-Time',
    description: 'Work together on documents, manage tasks, and join meetings with virtual whiteboards.',
  },
  {
    icon: BarChart,
    title: 'Track Progress Automatically',
    description: 'Get weekly digests and live reports — no need for manual check-ins.',
  },
]

export function HowItWorks() {
  return (
    <section className="relative overflow-hidden py-28 px-6 md:px-12 lg:px-24 text-gray-900">
      {/* 🔮 Harmonized animated blobs */}
      <motion.div
        className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-purple-100 opacity-20 rounded-full blur-3xl z-0"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 16, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-indigo-100 opacity-20 rounded-full blur-3xl z-0"
        animate={{ scale: [1, 1.25, 1] }}
        transition={{ repeat: Infinity, duration: 18, ease: 'easeInOut' }}
      />

      <div className="max-w-7xl mx-auto text-center relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold mb-16"
        >
          How It Works
        </motion.h2>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute hidden md:block top-1/2 left-0 right-0 h-1 bg-gray-200 z-0" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 relative z-10">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
                className={clsx(
                  'flex flex-col items-center text-center space-y-4 p-6 rounded-xl transition-all duration-300 bg-white/70 backdrop-blur-md border border-gray-200 shadow-md hover:shadow-xl'
                )}
              >
                {/* Icon with pulse */}
                <motion.div
                  className="w-14 h-14 flex items-center justify-center bg-gray-100 text-gray-800 rounded-full shadow-inner"
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.3 }}
                >
                  <Icon className="w-6 h-6" />
                </motion.div>

                <div className="text-sm text-gray-500 font-medium">
                  Step {index + 1}
                </div>

                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm text-gray-600 max-w-sm">{description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
