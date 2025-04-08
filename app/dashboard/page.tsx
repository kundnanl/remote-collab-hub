'use client'

import { useUser, useOrganization } from '@clerk/nextjs'
import WorkspaceScene from '@/components/dashboard/WorkspaceScene'

export default function DashboardPage() {
  const { user } = useUser()
  const { organization } = useOrganization()

  return (
    <main className="overflow-hidden">
      <WorkspaceScene />
    </main>
  )
}
