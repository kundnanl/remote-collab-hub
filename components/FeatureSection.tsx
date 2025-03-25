'use client'

import { motion } from "framer-motion"
import {
  Brain,
  Target,
  Users,
  Video,
  BarChart3,
  MessageCircle,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const features = [
  {
    icon: Brain,
    title: "Real-time Collaboration",
    description: "Edit docs, whiteboards, and tasks live with your team — no refresh required.",
  },
  {
    icon: Target,
    title: "Task Management",
    description: "Assign tasks, track progress, and stay organized across teams.",
  },
  {
    icon: Users,
    title: "Virtual Office",
    description: "See who's online, drop into rooms, and recreate the office vibe.",
  },
  {
    icon: Video,
    title: "Video + Whiteboards",
    description: "Meet and co-create in real time with built-in video + drawing tools.",
  },
  {
    icon: BarChart3,
    title: "Automated Reporting",
    description: "Track performance and progress without lifting a finger.",
  },
  {
    icon: MessageCircle,
    title: "Focused Chat",
    description: "Discuss tasks and projects in contextual chat threads.",
  },
]

export function FeatureGrid() {
  return (
    <section className="py-24 px-6 md:px-12 lg:px-24 text-gray-800">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-3xl md:text-4xl font-bold text-center mb-16"
        >
          Powerful Tools, Built for Remote Teams
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {features.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Card className="bg-white shadow-md border border-gray-200 hover:shadow-lg transition">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-sm text-gray-600">{description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
