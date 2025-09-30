import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createCaller } from '@/server'
import { PresenceProvider } from '@/components/presence/PresenceProvider'

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) redirect('/')

  const caller = await createCaller()
  const me = await caller.user.me()

  const initialMe = {
    userId,
    name: me?.name ?? null,
    imageUrl: me?.imageUrl ?? null,
    orgId: orgId!,
    roomId: null,
    status: 'online' as const,
  }

  return (
    <PresenceProvider orgId={orgId!} me={initialMe}>
      {children}
    </PresenceProvider>
  )
}
