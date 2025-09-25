"use client";

import { useUser } from "@clerk/nextjs";
import { usePresence } from "@/lib/hooks/usePresence";
import { useJoinRoom, useLeaveRoom } from "@/lib/hooks/useRoomPresence";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LogIn, LogOut, Users } from "lucide-react";
import { motion } from "framer-motion";

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
      leaveRoom.mutate({ roomId: id, userId: user.id });
    } else {
      joinRoom.mutate({ roomId: id, userId: user.id });
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card className="flex flex-col justify-between h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">{name}</CardTitle>
            <Users className="w-5 h-5 text-muted-foreground" />
          </div>
          {description && (
            <CardDescription className="mt-1">{description}</CardDescription>
          )}
        </CardHeader>

        <div className="flex flex-wrap gap-2 px-6 pb-4">
          {members.length > 0 ? (
            members.map((m) => (
              <Avatar key={m.userId} className="w-8 h-8">
                <AvatarImage src={m.imageUrl ?? "/avatar.svg"} />
                <AvatarFallback>{m.name?.charAt(0) ?? "U"}</AvatarFallback>
              </Avatar>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No one here yet</p>
          )}
        </div>

        <CardFooter>
          <Button
            onClick={handleToggleRoom}
            className="w-full"
            variant={isInRoom ? "destructive" : "default"}
          >
            {isInRoom ? (
              <>
                <LogOut className="w-4 h-4 mr-2" /> Leave Room
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" /> Join Room
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
