import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";


export default async function DashboardLayout({ children }: { children: ReactNode }) {

  const { userId } = await auth()

  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { onboardingComplete: true },
  });


  if (!user?.onboardingComplete) {
    redirect("/onboarding");
  }


  return (
    <main className="min-h-screen">
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
