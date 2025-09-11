"use client";

import { useUser } from "@clerk/nextjs";
import { usePresence } from "@/lib/hooks/usePresence";
import {
  useJoinRoom,
  useLeaveRoom,
} from "@/lib/hooks/useRoomPresence";
import Image from "next/image";

type RoomCardProps = {
  id: string;
  name: string;
  description?: string;
};

export default function RoomCard({ id, name, description }: RoomCardProps) {
  const { user } = useUser();
  const members = usePresence(id);

  const joinRoom = useJoinRoom();
  const leaveRoom = useLeaveRoom();

  const isInRoom = members.some((m) => m.userId === user?.id);

  const handleToggleRoom = () => {
    if (!user) return;

    if (isInRoom) {
      // leave in DB
      leaveRoom.mutate({ roomId: id, userId: user.id });
      // Supabase presence will auto-untrack when component unmounts/unsubscribes
    } else {
      // join in DB
      joinRoom.mutate({ roomId: id, userId: user.id });
      // presence hook already handles "track" when user enters channel
    }
  };

  return (
    <div className="border rounded p-4 shadow-sm flex flex-col">
      <h3 className="font-bold">{name}</h3>
      {description && <p className="text-sm text-gray-500">{description}</p>}

      <div className="mt-2 flex -space-x-2">
        {members.map((m) => (
          <Image
            key={m.userId}
            src={m.imageUrl ?? "/avatar.svg"}
            alt={m.name ?? "user"}
            className="w-8 h-8 rounded-full border-2 border-white"
          />
        ))}
      </div>

      <button
        className="mt-3 bg-blue-500 text-white px-3 py-1 rounded"
        onClick={handleToggleRoom}
      >
        {isInRoom ? "Leave Room" : "Join Room"}
      </button>
    </div>
  );
}
