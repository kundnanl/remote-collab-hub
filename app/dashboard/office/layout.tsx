import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import ClientPresenceWrapper from './presence-wrapper';

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/');

  return (
    <ClientPresenceWrapper orgId={orgId}>
      {children}
    </ClientPresenceWrapper>
  );
}
