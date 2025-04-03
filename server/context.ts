import { auth } from '@clerk/nextjs/server'

export const createContext = async () => {
  const authData = await auth()

  return {
    auth: authData,
    userId: authData.userId,
    orgId: authData.orgId,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
