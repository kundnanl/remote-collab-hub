'use client';

import { Button } from '@/components/ui/button';
import { StatusMenu } from '@/components/dashboard/StatusMenu';
import { useOrgPresence } from '@/components/presence/PresenceProvider';

export function CurrentRoomBar() {
  const { me, leaveRoom, roomMembers } = useOrgPresence();
  const inRoom = !!me?.roomId;
  if (!inRoom) return null;

  const count = me?.roomId ? roomMembers(me.roomId).length : 0;

  return (
    <div className="sticky top-0 z-30 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
        <div className="text-sm">
          <span className="font-medium">You’re in a room</span>
          <span className="text-muted-foreground"> • {count} present</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusMenu />
          <Button variant="outline" onClick={() => leaveRoom()}>
            Leave room
          </Button>
        </div>
      </div>
    </div>
  );
}
