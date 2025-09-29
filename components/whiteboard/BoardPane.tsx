"use client";

import "tldraw/tldraw.css";
import { Tldraw, DefaultStylePanel } from "tldraw";
import {
  LiveblocksProvider,
  RoomProvider,
  ClientSideSuspense,
  useSelf,
} from "@liveblocks/react/suspense";
import { useMemo } from "react";
import { trpc } from "@/server/client";
import { useYjsStore } from "@/components/whiteboard/useYjsStore";
import { liveblocksClient } from "@/lib/liveblocksClient";

function YjsTldraw() {
  // Grab the full "me" so we don't call useSelf twice
  const me = useSelf((m) => m);

  // Memoize the user object so its identity is stable
  const user = useMemo(() => {
    if (!me) return null;
    const { id, info } = me;
    return {
      id,
      color: info?.color ?? "#6E6E6E",
      name: info?.name ?? "Anonymous",
    };
  }, [me?.id, me?.info?.color, me?.info?.name]);

  const storeWithStatus = useYjsStore({
    user: user ?? undefined,
  });

  if (storeWithStatus.status !== "synced-remote") {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading board…
      </div>
    );
  }

  return <Tldraw store={storeWithStatus.store} autoFocus />;
}

export default function BoardPane({ roomId }: { roomId: string }) {
  const { data, isLoading, error } = trpc.whiteboard.getOrCreate.useQuery({ roomId });

  if (isLoading) return <div>Preparing board…</div>;
  if (error || !data) return <div>Could not load board</div>;

  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks/auth">
      <RoomProvider id={data.storageKey} initialPresence={{ cursor: null }}>
        <ClientSideSuspense fallback={<div className="p-4">Connecting…</div>}>
          {() => <YjsTldraw />}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
