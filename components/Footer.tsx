'use client'

import { Github, Twitter, Linkedin } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

export function Footer() {
  return (
    <footer className="border-t border-gray-200 text-gray-800">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24 py-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10 md:gap-6">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="flex flex-col items-start"
          >
            <h2 className="text-xl font-bold mb-2">RemoteHub</h2>
            <p className="text-sm text-gray-500 max-w-sm">
              Built for remote teams to collaborate like they’re side-by-side.
            </p>
          </motion.div>

          {/* Navigation */}
          <motion.nav
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row items-start md:items-center gap-4 text-sm font-medium"
          >
            <Link href="/">Home</Link>
            <Link href="#features">Features</Link>
            <Link href="#how-it-works">How It Works</Link>
            <Link href="/sign-up">Get Started</Link>
          </motion.nav>

          {/* Socials */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            viewport={{ once: true }}
            className="flex items-center space-x-4"
          >
            <a href="https://github.com" target="_blank" rel="noreferrer">
              <Github className="w-5 h-5 hover:text-gray-600 transition" />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer">
              <Twitter className="w-5 h-5 hover:text-gray-600 transition" />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer">
              <Linkedin className="w-5 h-5 hover:text-gray-600 transition" />
            </a>
          </motion.div>
        </div>

        {/* Bottom */}
        <div className="mt-12 border-t pt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} RemoteHub. Built with 💜 by humans.
        </div>
      </div>
    </footer>
  )
}
