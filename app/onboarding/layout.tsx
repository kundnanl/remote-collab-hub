import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/server/db'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  const existingUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { onboardingComplete: true },
  })

  if (existingUser?.onboardingComplete) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
