import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/');

return <>{children}</>
}
