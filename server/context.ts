import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/server/db'

export const createContext = async () => {
  const authData = await auth()

  return {
    prisma,
    auth: authData,
    userId: authData.userId,
    orgId: authData.orgId,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
