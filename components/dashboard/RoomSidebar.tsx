'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOrgPresence } from '@/components/presence/PresenceProvider';
import DailyIframe, { DailyParticipant } from '@daily-co/daily-js';

export function RoomSidebar({ roomId }: { roomId: string }) {
  const { roomMembers } = useOrgPresence();
  const presence = roomMembers(roomId);

  const [participants, setParticipants] = React.useState<Record<string, DailyParticipant>>({});

  React.useEffect(() => {
    const call = DailyIframe.getCallInstance();
    if (!call) return;

    const update = () => setParticipants(call.participants() ?? {});
    update();
    call.on('participant-joined', update);
    call.on('participant-updated', update);
    call.on('participant-left', update);
    return () => {
      call.off('participant-joined', update);
      call.off('participant-updated', update);
      call.off('participant-left', update);
    };
  }, []);

  const byUserId = new Map<
    string,
    { name: string; imageUrl?: string | null; inCall: boolean; status?: string | null }
  >();

  presence.forEach((m) => {
    byUserId.set(m.userId, { name: m.name ?? 'User', imageUrl: m.imageUrl, inCall: false, status: m.status });
  });

  Object.values(participants).forEach((p) => {
    if (!p.user_id) return;
    const entry = byUserId.get(p.user_id);
    if (entry) entry.inCall = true;
    else byUserId.set(p.user_id, { name: p.user_name ?? 'User', imageUrl: undefined, inCall: true, status: 'online' });
  });

  const rows = Array.from(byUserId.entries()).map(([userId, info]) => ({ userId, ...info }));

  return (
    <aside className="hidden lg:block sticky top-0 h-[100dvh] w-[280px] shrink-0 border-l bg-background p-4">
      <h3 className="mb-3 text-sm font-semibold">In this room</h3>
      <ul className="space-y-2">
        {rows.map((m) => (
          <li key={m.userId} className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={m.imageUrl ?? undefined} />
              <AvatarFallback>{m.name?.[0] ?? 'U'}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm flex items-center gap-2">
                {m.name}
                {m.inCall && (
                  <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-1.5 py-0.5 text-[10px]">
                    in call
                  </span>
                )}
              </div>
              <div className="text-xs capitalize text-muted-foreground">{m.status ?? 'online'}</div>
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="text-xs text-muted-foreground">No one else is here… yet</li>}
      </ul>
    </aside>
  );
}
