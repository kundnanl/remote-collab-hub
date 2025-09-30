import { auth } from '@clerk/nextjs/server'
import { createCaller } from '@/server'
import OfficeView from '@/components/dashboard/VirtualOffice'
import { redirect } from 'next/navigation'

export default async function OfficePage() {
  const { userId, orgId } = await auth()
  if (!userId || !orgId) { redirect('/') }

  const caller = await createCaller()
  const rooms = await caller.rooms.listByOrg({ orgId: orgId! })

  return (
    <OfficeView
      initialRooms={rooms.map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))}
      orgId={orgId!}
    />
  )
}
