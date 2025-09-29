"use client";
import { RoomProvider, useMyPresence } from "@liveblocks/react";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";

function PresenceAvatar() {
  const [{ cursor }] = useMyPresence();
  // optional: render your own presence cursors/avatars
  return null;
}

export default function BoardPane({ roomId }: { roomId: string }) {
  const liveblocksRoomId = `lb_${roomId}`;

  return (
    <RoomProvider id={liveblocksRoomId} initialPresence={{ cursor: null }}>
      <div style={{ height: "100%", minHeight: 360 }}>
        <Tldraw />
        <PresenceAvatar />
      </div>
    </RoomProvider>
  );
}
