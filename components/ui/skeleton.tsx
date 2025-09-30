"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-muted rounded-md", className)} />;
}

export const SkeletonText = ({ lines = 3 }: { lines?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={cn("h-4 w-full", i === 0 && "w-2/3")} />
    ))}
  </div>
);

export const SkeletonBadge = () => <Skeleton className="h-5 w-16 rounded-full" />;
export const SkeletonButton = () => <Skeleton className="h-9 w-28 rounded-full" />;
