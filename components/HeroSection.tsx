'use client'

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"

import Docs from "@/public/Docs.png"
import Image from "next/image"
import { useState } from "react"
import FullPageLoader from "./FullPageLoader"


const HeroSection = () => {
    const [showLoader, setShowLoader] = useState(false)
    
    const router = useRouter()

    return (
        <section className="px-6 md:px-12 lg:px-24 py-24 text-gray-900">
            {showLoader && <FullPageLoader />}
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            {/* Text Block */}
            <div className="space-y-8">
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight"
              >
                Built for Remote Teams,  
                <br />
                Designed for Flow.
              </motion.h1>
    
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="text-lg text-gray-600 max-w-lg"
              >
                A modern remote work collaboration hub that feels like you&apos;re in the same room. Video calls, whiteboards, tasks, real-time docs — all in one clean space.
              </motion.p>
    
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <Button
                  size="lg"
                  onClick={() => 
                    {
                        setShowLoader(true)
                        router.push("/sign-up")}}
                  className="px-6 py-3 text-base font-medium rounded-xl bg-black text-white hover:bg-gray-800 transition"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            </div>
    
            {/* Mockup / Image Area */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-gray-200 backdrop-blur-sm bg-white/50"
            >
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400 text-sm">
              <Image
                  src={Docs}
                  alt="Picture of the author"
                  height={500}
                  width={700}
                  />
              </div>
            </motion.div>
          </div>
        </section>
      )
}
 
export default HeroSection;

