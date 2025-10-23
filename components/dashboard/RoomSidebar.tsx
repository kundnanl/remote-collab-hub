'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOrgPresence } from '@/components/presence/PresenceProvider';

export function RoomSidebar({ roomId }: { roomId: string }) {
  const { roomMembers } = useOrgPresence();
  const members = roomMembers(roomId);

  return (
    <aside className="hidden lg:block sticky top-0 h-[100dvh] w-72 shrink-0 border-l bg-background p-4">
      <h3 className="mb-3 text-sm font-semibold">In this room</h3>
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.userId + m.ref} className="flex items-center gap-3">
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
        {members.length === 0 && (
          <li className="text-xs text-muted-foreground">No one else is here… yet</li>
        )}
      </ul>
    </aside>
  );
}
