// components/dashboard/CurrentRoomBar.tsx
'use client'
import { usePresence } from '@/components/presence/PresenceProvider'
import { Button } from '@/components/ui/button'
import { StatusMenu } from '@/components/dashboard/StatusMenu';

export function CurrentRoomBar() {
  const { roomMembers, me, joinRoom } = usePresence()
  const inRoom = me.roomId !== null
  const count = roomMembers.size

  if (!inRoom) return null
  return (
    <div className="sticky top-0 z-30 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
        <div className="text-sm">
          <span className="font-medium">You’re in a room</span>
          <span className="text-muted-foreground"> • {count} present</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusMenu />
          <Button variant="outline" onClick={() => joinRoom(null)}>Leave room</Button>
        </div>
      </div>
    </div>
  )
}
