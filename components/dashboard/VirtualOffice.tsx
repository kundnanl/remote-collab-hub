"use client";

import * as React from "react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, Video, LogOut, Pencil, Link as LinkIcon, Trash2, Dot } from "lucide-react";

import { trpc } from "@/server/client";
import type { RouterOutputs } from "@/server/client";
type RoomType = RouterOutputs["rooms"]["listByOrg"][number];

import { usePresence } from "@/components/presence/PresenceProvider";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { CreateRoomDialog } from "./CreateRoomDialog";
import { EditRoomDialog } from "@/components/dashboard/EditRoomDialog";
import { UserStatus } from "@/lib/presence";

function pill(cls = "") {
  return `inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border ${cls}`;
}

export default function VirtualOffice({
  initialRooms,
  orgId,
}: {
  initialRooms: RoomType[];
  orgId: string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 space-y-6">
        <Header orgId={orgId} />
        <OfficeGrid orgId={orgId} initialRooms={initialRooms} />
      </div>
      <div className="lg:col-span-1">
        <OrgRoster />
      </div>
    </div>
  );
}

function OrgRoster() {
  const { orgMembers } = usePresence();
  const members = [...orgMembers.values()];
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold mb-2">People in org</h2>
      <div className="space-y-2">
        {members.length === 0 && (
          <div className="text-xs text-muted-foreground">No one online</div>
        )}
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={m.imageUrl ?? undefined} />
              <AvatarFallback>{m.name?.[0] ?? "U"}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{m.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {m.status === "online"
                ? "Online"
                : m.status === "focus"
                  ? "Focus"
                  : "Do Not Disturb"}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Header({ orgId }: { orgId: string }) {
  const { me, setStatus } = usePresence();

  const nextStatus = (): UserStatus =>
    me.status === 'online' ? 'focus' : me.status === 'focus' ? 'dnd' : 'online';

  const label =
    me.status === 'online' ? 'Available' :
      me.status === 'focus' ? 'Focus' :
        'Do Not Disturb';

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Virtual office</h1>
        <div className="text-sm text-muted-foreground">Jump into rooms, see who’s around, and collaborate fast.</div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setStatus(nextStatus())}>
          <Dot className="h-5 w-5 -ml-1" />
          {label}
        </Button>
        <CreateRoomDialog orgId={orgId} />
      </div>
    </div>
  );
}

function OfficeGrid({ orgId, initialRooms }: { orgId: string; initialRooms: RoomType[] }) {
  const utils = trpc.useUtils();
  const router = useRouter();
  const roomsQ = trpc.rooms.listByOrg.useQuery({ orgId }, { initialData: initialRooms });
  const activeSessionsQ = trpc.rooms.activeSessionsByOrg.useQuery({ orgId });

  const { orgMembers, currentRoomId, joinRoom, leaveRoom } = usePresence();

  const removeRoom = trpc.rooms.remove.useMutation({
    onSuccess: (_, { roomId }) => {
      utils.rooms.listByOrg.setData({ orgId }, (old) => old ? old.filter(r => r.id !== roomId) : []);
    },
  });

  const activeMap = useMemo(() => {
    const map = new Map<string, Date>();
    for (const s of activeSessionsQ.data ?? []) map.set(s.roomId, new Date(s.startedAt));
    return map;
  }, [activeSessionsQ.data]);

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {(roomsQ.data ?? []).map((room) => {
        const occupants = [...orgMembers.values()].filter(m => m.roomId === room.id);
        const youAreHere = currentRoomId === room.id;
        const liveSince = activeMap.get(room.id);

        return (
          <Card key={room.id} className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{room.name}</div>
                  <span className={pill("text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700")}>
                    {room.kind.toLowerCase()}
                  </span>
                  {occupants.length > 0 && (
                    <span className={pill("border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300")}>
                      Live {liveSince ? `• ${formatDistanceToNow(liveSince, { addSuffix: true })}` : ""}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {occupants.length} inside
                </div>
              </div>

              <div className="flex items-center gap-1">
                {!youAreHere ? (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await joinRoom(room.id);
                      router.push(`/dashboard/office/room/${room.id}`);
                    }}
                    className="gap-1"
                  >
                    <Video className="h-4 w-4" /> Join
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await leaveRoom();
                    }}
                    className="gap-1"
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
                      trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
                        <Pencil className="h-4 w-4" /> Edit
                      </DropdownMenuItem>}
                    />
                    <DropdownMenuItem
                      className="gap-2"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/dashboard/office/room/${room.id}`);
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
            <div className="mt-3 flex items-center gap-2">
              <div className="flex -space-x-2">
                {occupants.slice(0, 6).map((o, i) => (
                  <Avatar
                    key={o.userId ?? `occ-${i}`}
                    className="h-7 w-7 ring-2 ring-white dark:ring-slate-900"
                  >
                    <AvatarImage src={o.imageUrl ?? undefined} />
                    <AvatarFallback>{o.name?.[0] ?? "U"}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {occupants.length > 6 && (
                <span className="text-xs text-muted-foreground">+{occupants.length - 6}</span>
              )}
              {occupants.length === 0 && (
                <span className="text-xs text-muted-foreground">No one here yet</span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
