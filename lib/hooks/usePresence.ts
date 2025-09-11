"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@clerk/nextjs";

type PresenceUser = {
  userId: string;
  name: string | null;
  imageUrl?: string | null;
  status: "ONLINE" | "OFFLINE" | "IDLE" | "IN_MEETING";
};

export function usePresence(roomId: string) {
  const { user } = useUser();
  const [members, setMembers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: {
          key: user.id, // unique identifier
        },
      },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceUser>();
      const allMembers = Object.values(state).flat() as PresenceUser[];
      setMembers(allMembers);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.track({
          userId: user.id,
          name: user.fullName,
          imageUrl: user.imageUrl,
          status: "ONLINE",
        });
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, user]);

  return members;
}
