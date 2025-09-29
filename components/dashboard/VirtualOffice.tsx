"use client";

import {
  PresenceProvider,
  usePresence,
} from "@/components/presence/PresenceProvider";
import { trpc } from "@/server/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { OrgPresenceState } from "@/lib/presence";
import type { RouterOutputs } from "@/server/client";
type RoomType = RouterOutputs["rooms"]["listByOrg"][number];
import { supabase } from "@/lib/supabaseClient";
import { useEffect } from "react";
import { CreateRoomDialog } from "./CreateRoomDialog";
import { EditRoomDialog } from "@/components/dashboard/EditRoomDialog";
import { CurrentRoomBar } from "@/components/dashboard/CurrentRoomBar";
import { RoomSidebar } from "@/components/dashboard/RoomSidebar";
import { useRouter } from "next/navigation";

type Props = {
  initialRooms: RoomType[];
  orgId: string;
  me: OrgPresenceState;
};

export default function VirtualOffice({ initialRooms, orgId, me }: Props) {
  return (
    <PresenceProvider orgId={orgId} me={me}>
      <OfficeInner initialRooms={initialRooms} orgId={orgId} />
    </PresenceProvider>
  );
}

function OfficeInner({
  initialRooms,
  orgId,
}: {
  initialRooms: RoomType[];
  orgId: string;
}) {
  const utils = trpc.useUtils();
  const roomsQuery = trpc.rooms.listByOrg.useQuery(
    { orgId },
    { initialData: initialRooms }
  );

  const removeRoom = trpc.rooms.remove.useMutation({
    onSuccess: (_, { roomId }) => {
      utils.rooms.listByOrg.setData({ orgId }, (old) =>
        old ? old.filter((r) => r.id !== roomId) : []
      );
    },
  });

  // 🔑 Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel(`public:Room:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "Room",
          filter: `orgId=eq.${orgId}`,
        },
        (payload) => {
          console.log("Realtime change:", payload);
          // Re-sync TRPC cache depending on event
          if (payload.eventType === "INSERT") {
            const newRoom = payload.new as RoomType;
            utils.rooms.listByOrg.setData({ orgId }, (old) =>
              old ? [...old, newRoom] : [newRoom]
            );
          }
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as RoomType;
            utils.rooms.listByOrg.setData({ orgId }, (old) =>
              old ? old.filter((r) => r.id !== deleted.id) : []
            );
          }
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as RoomType;
            utils.rooms.listByOrg.setData({ orgId }, (old) =>
              old ? old.map((r) => (r.id === updated.id ? updated : r)) : []
            );
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [orgId, utils]);

  return (
    <div className="space-y-6">
      <CurrentRoomBar />
      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Virtual Office</h1>
            <CreateRoomDialog orgId={orgId} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roomsQuery.data?.map((r) => (
              <RoomCard
                key={r.id}
                room={r}
                orgId={orgId}
                onRemove={() => removeRoom.mutate({ roomId: r.id, orgId })}
              />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="hidden lg:block w-72 shrink-0">
          <RoomSidebar />
        </div>
      </div>
    </div>
  );
}

function RoomCard({
  room,
  orgId,
  onRemove,
}: {
  room: RoomType;
  orgId: string;
  onRemove: () => void;
}) {
  const { orgMembers, joinRoom } = usePresence();
  const occupants = [...orgMembers.values()].filter(
    (m) => m.roomId === room.id
  );

  const isActive = occupants.length > 0;
  const activeSessionQ = trpc.rooms.activeSession.useQuery({ roomId: room.id });
  const router = useRouter();

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{room.name}</div>
          <div className="text-sm text-muted-foreground">
            {room.kind.toLowerCase()} • {occupants.length} inside
            {activeSessionQ.data?.startedAt && (
              <>
                {" "}
                • active since{" "}
                {new Date(activeSessionQ.data.startedAt).toLocaleTimeString()}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isActive ? "secondary" : "default"}
            onClick={() => {
              joinRoom(room.id);
              router.push(`/dashboard/office/room/${room.id}`); 
            }}
          >
            {isActive ? "Join" : "Enter"}
          </Button>
          <EditRoomDialog
            orgId={orgId}
            room={room}
            trigger={<Button variant="outline">Edit</Button>}
          />
          <Button variant="ghost" onClick={onRemove} aria-label="Delete room">
            🗑️
          </Button>
        </div>
      </div>

      <div className="flex -space-x-2">
        {occupants.slice(0, 5).map((o) => (
          <Avatar key={o.userId}>
            <AvatarImage src={o.imageUrl ?? undefined} />
            <AvatarFallback>{o.name?.[0] ?? "U"}</AvatarFallback>
          </Avatar>
        ))}
      </div>
    </Card>
  );
}
