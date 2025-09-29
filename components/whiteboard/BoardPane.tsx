"use client";

import "tldraw/tldraw.css";
import { Tldraw } from "tldraw";
import {
  LiveblocksProvider,
  RoomProvider,
  ClientSideSuspense,
  useSelf,
} from "@liveblocks/react/suspense";
import { useMemo } from "react";
import { trpc } from "@/server/client";
import { useYjsStore } from "@/components/whiteboard/useYjsStore";

function YjsTldraw() {
  const me = useSelf((m) => m);
  const user = useMemo(() => {
    if (!me || !me.id) return undefined;

    return {
      id: me.id,
      color: typeof me.info?.color === "string" ? me.info.color : "#6E6E6E",
      name: typeof me.info?.name === "string" ? me.info.name : "Anonymous",
    };
  }, [me]);

  const storeWithStatus = useYjsStore({ user: user ?? undefined });

  if (storeWithStatus.status !== "synced-remote") {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading board…
      </div>
    );
  }

  // Make sure Tldraw fills entire parent
  return <Tldraw store={storeWithStatus.store} autoFocus className="h-full w-full" />;
}

export default function BoardPane({ roomId }: { roomId: string }) {
  const { data, isLoading, error } = trpc.whiteboard.getOrCreate.useQuery({ roomId });

  if (isLoading) return <div className="flex h-full items-center justify-center">Preparing board…</div>;
  if (error || !data) return <div className="flex h-full items-center justify-center">Could not load board</div>;

  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks/auth">
      <RoomProvider id={data.storageKey} initialPresence={{ cursor: null }}>
        <ClientSideSuspense fallback={<div className="p-4">Connecting…</div>}>
          {() => (
            <div className="h-full w-full">
              <YjsTldraw />
            </div>
          )}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
