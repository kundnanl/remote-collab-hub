'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  MoreHorizontal,
  Video,
  LogOut,
  Pencil,
  Link as LinkIcon,
  Trash2,
  Users,
} from 'lucide-react';

import { trpc } from '@/server/client';
import type { RouterOutputs } from '@/server/client';
type RoomType = RouterOutputs['rooms']['listByOrg'][number];

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { CreateRoomDialog } from '@/components/dashboard/CreateRoomDialog';
import { EditRoomDialog } from '@/components/dashboard/EditRoomDialog';
import { useOrgPresence } from '@/components/presence/PresenceProvider';

function badge(cls = '') {
  return `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${cls}`;
}

function LiveBadge({ since }: { since: Date | null }) {
  if (!since) return null;
  return (
    <span
      className={badge(
        'border-emerald-300/50 text-emerald-800 dark:text-emerald-300 dark:border-emerald-900/60' +
          ' shadow-[0_0_0_3px_rgba(16,185,129,0.08)]'
      )}
      title={`Live since ${since.toLocaleString()}`}
    >
      • Live {`• ${formatDistanceToNow(since, { addSuffix: true })}`}
    </span>
  );
}

export default function VirtualOffice({
  initialRooms,
  orgId,
}: {
  initialRooms: RoomType[];
  orgId: string;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Header orgId={orgId} />
      <OfficeGrid orgId={orgId} initialRooms={initialRooms} />
    </div>
  );
}

function Header({ orgId }: { orgId: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Virtual office</h1>
        <p className="text-sm text-muted-foreground">
          Jump into rooms, see who’s around, and collaborate fast.
        </p>
      </div>
      <CreateRoomDialog orgId={orgId} />
    </div>
  );
}

function Occupants({
  occupants,
}: {
  occupants: Array<{ userId: string; ref: string; name?: string | null; imageUrl?: string | null }>;
}) {
  if (occupants.length === 0) {
    return <span className="text-xs text-muted-foreground">No one here yet</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {occupants.slice(0, 5).map((o) => (
          <Avatar
            key={o.userId + o.ref}
            className="h-7 w-7 ring-2 ring-white dark:ring-slate-900"
            title={o.name ?? 'User'}
          >
            <AvatarImage src={o.imageUrl ?? undefined} />
            <AvatarFallback>{o.name?.[0] ?? 'U'}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      {occupants.length > 5 && (
        <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">
          +{occupants.length - 5}
        </span>
      )}
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        {occupants.length} inside
      </span>
    </div>
  );
}

function OfficeGrid({
  orgId,
  initialRooms,
}: {
  orgId: string;
  initialRooms: RoomType[];
}) {
  const utils = trpc.useUtils();
  const router = useRouter();
  const roomsQ = trpc.rooms.listByOrg.useQuery({ orgId }, { initialData: initialRooms });

  const { me, roomMembers, liveSince, leaveRoom, joinRoom } = useOrgPresence();

  const removeRoom = trpc.rooms.remove.useMutation({
    onSuccess: (_, { roomId }) => {
      utils.rooms.listByOrg.setData({ orgId }, (old) => (old ? old.filter((r) => r.id !== roomId) : []));
    },
  });

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {(roomsQ.data ?? []).map((room) => {
        const occupants = roomMembers(room.id);
        const youAreHere = me?.roomId === room.id;
        const since = liveSince(room.id);

        return (
          <Card
            key={room.id}
            className={[
              'group relative overflow-hidden rounded-xl border bg-white/70 p-4 shadow-sm backdrop-blur',
              'transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900/70',
            ].join(' ')}
          >
            {/* subtle gradient accent */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-medium">{room.name}</h3>
                  <span className={badge('border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300')}>
                    {room.kind.toLowerCase()}
                  </span>
                  {occupants.length > 0 && <LiveBadge since={since} />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {'Quick huddles, syncs, and deep work.'}
                </p>
              </div>

              <div className="flex items-center gap-1">
                {!youAreHere ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      // optimistic feedback
                      joinRoom(room.id).then(() => {
                        router.push(`/dashboard/office/room/${room.id}`);
                      });
                    }}
                    className="gap-1"
                    aria-label={`Join ${room.name}`}
                  >
                    <Video className="h-4 w-4" /> Join
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => leaveRoom()}
                    className="gap-1"
                    aria-label="Leave room"
                  >
                    <LogOut className="h-4 w-4" /> Leave
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="outline" aria-label="Room actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[180px]">
                    <EditRoomDialog
                      orgId={orgId}
                      room={room}
                      trigger={
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                      }
                    />
                    <DropdownMenuItem
                      className="gap-2"
                      onClick={() => {
                        const link = `${window.location.origin}/dashboard/office/room/${room.id}`;
                        navigator.clipboard.writeText(link).catch(() => {});
                      }}
                    >
                      <LinkIcon className="h-4 w-4" /> Copy link
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2 text-red-600 focus:text-red-600"
                      onClick={() => removeRoom.mutate({ roomId: room.id, orgId })}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* occupants */}
            <div className="mt-4">
              <Occupants occupants={occupants} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
