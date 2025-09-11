"use client";

import RoomCard from "./RoomCard";
import { useRooms } from "@/lib/hooks/useRooms";

type OfficeLayoutProps = {
  officeId: string;
};

export default function OfficeLayout({ officeId }: OfficeLayoutProps) {
  const { data: rooms, isLoading } = useRooms(officeId);

  if (isLoading) return <p>Loading rooms...</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {rooms?.map((room) => (
        <RoomCard
          key={room.id}
          id={room.id}
          name={room.name}
          description={room.description ?? ""}
        />
      ))}
    </div>
  );
}
