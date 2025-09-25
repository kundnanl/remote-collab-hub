"use client";

import RoomCard from "./RoomCard";
import { useRooms } from "@/lib/hooks/useRooms";
import { Loader2, PlusCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type Room = {
  id: string;
  name: string;
  description?: string | null;
};

type OfficeLayoutProps = {
  officeId: string;
};

export default function OfficeLayout({ officeId }: OfficeLayoutProps) {
  const { data: rooms, isLoading } = useRooms(officeId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading rooms...</span>
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-16 text-center">
        <img src="/empty-docs.svg" alt="No rooms" className="w-32 h-32 mb-6 opacity-80" />
        <p className="mb-4 text-muted-foreground">No rooms yet. Start by creating one!</p>
        <Button>
          <PlusCircle className="w-4 h-4 mr-2" />
          Create Room
        </Button>
      </Card>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        layout
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {rooms.map((room: Room) => (
          <motion.div
            key={room.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <RoomCard
              id={room.id}
              name={room.name}
              description={room.description ?? ""}
            />
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
