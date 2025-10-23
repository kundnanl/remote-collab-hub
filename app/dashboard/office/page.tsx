import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createCaller } from '@/server';
import VirtualOffice from '@/components/dashboard/VirtualOffice';

export default async function OfficePage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/');

  const caller = await createCaller();
  const rooms = await caller.rooms.listByOrg({ orgId });

  return (
    <VirtualOffice
      initialRooms={rooms.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))}
      orgId={orgId}
    />
  );
}
