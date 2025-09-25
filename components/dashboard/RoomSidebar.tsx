'use client'
import { usePresence } from '@/components/presence/PresenceProvider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function RoomSidebar() {
  const { roomMembers } = usePresence()
  if (roomMembers.size === 0) return null

  const members = [...roomMembers.values()]

  return (
    <aside className="sticky top-16 h-[calc(100vh-4rem)] w-72 shrink-0 border-l bg-background p-4 hidden lg:block">
      <h3 className="mb-3 text-sm font-semibold">In this room</h3>
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={m.imageUrl ?? undefined} />
              <AvatarFallback>{m.name?.[0] ?? 'U'}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm">{m.name ?? 'User'}</div>
              <div className="text-xs capitalize text-muted-foreground">{m.status}</div>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
