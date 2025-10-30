'use client';

import { PresenceProvider } from '@/components/presence/PresenceProvider';

export default function ClientPresenceWrapper({
  orgId,
  children,
}: {
  orgId: string;
  children: React.ReactNode;
}) {
  return <PresenceProvider orgId={orgId}>{children}</PresenceProvider>;
}
