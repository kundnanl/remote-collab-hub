"use client";

import { motion, AnimatePresence } from "framer-motion";

export function PageLoader({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="skeleton-loader"
          className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col gap-6 p-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Top bar shimmer */}
          <div className="h-10 w-40 rounded-md bg-muted animate-pulse" />
          {/* Content skeleton */}
          <div className="flex flex-col gap-4">
            <div className="h-6 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-6 w-2/4 rounded bg-muted animate-pulse" />
            <div className="h-6 w-full rounded bg-muted animate-pulse" />
          </div>
          {/* Fake cards */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-lg bg-muted animate-pulse"
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
