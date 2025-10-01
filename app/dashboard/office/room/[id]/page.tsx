"use client";

import { use, useEffect, useRef, useState } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { useRouter } from "next/navigation";
import BoardPane from "@/components/whiteboard/BoardPane";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { trpc } from "@/server/client";
import { usePresence } from "@/components/presence/PresenceProvider";

export default function OfficeRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callRef = useRef<DailyCall | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

  const tokenMutation = trpc.rtc.getToken.useMutation();
  const { joinRoom, leaveRoom } = usePresence();

  // Track whether THIS effect actually joined presence
  const joinedViaThisEffectRef = useRef(false);

  // Dev-only: React 18 StrictMode runs mount -> cleanup -> mount.
  // We skip the first synthetic cleanup so we don't prematurely leave the room.
  const devCleanupSkipRef = useRef(0);

  useEffect(() => {
    let aborted = false;
    let currentCall: DailyCall | null = null;

    async function joinCall() {
      if (isInitialized || callRef.current) return;

      try {
        console.log("[OfficeRoomPage] joinCall -> presence join", id);
        await joinRoom(id);
        joinedViaThisEffectRef.current = true;

        console.log("[OfficeRoomPage] fetching token/url");
        const { token, url } = await tokenMutation.mutateAsync({ roomId: id });
        if (aborted || callRef.current) return;

        const parent = containerRef.current ?? document.body;
        const call = DailyIframe.createFrame(parent, {
          showLeaveButton: true,
          iframeStyle: { width: "100%", height: "100%", border: "0" },
        });

        currentCall = call;
        callRef.current = call;
        setIsInitialized(true);

        call.on("left-meeting", async () => {
          console.log("[OfficeRoomPage] left-meeting");
          if (!aborted) {
            await leaveRoom();
            router.push("/dashboard/office");
          }
        });

        call.on("error", (error) => {
          console.error("[OfficeRoomPage] Daily error:", error);
        });

        console.log("[OfficeRoomPage] joining daily", { url });
        await call.join({ url, token });
      } catch (err) {
        console.error("[OfficeRoomPage] Failed to join call:", err);
        setIsInitialized(false);
        if (!aborted) {
          await leaveRoom();
          router.push("/dashboard/office");
        }
      }
    }

    void joinCall();

    return () => {
      console.log("[OfficeRoomPage] cleanup useEffect");

      // Skip the FIRST dev-only cleanup from StrictMode
      if (process.env.NODE_ENV !== "production") {
        devCleanupSkipRef.current += 1;
        if (devCleanupSkipRef.current === 1) {
          console.log("[OfficeRoomPage] dev-first-cleanup skipped");
          return;
        }
      }

      aborted = true;

      const cleanup = async () => {
        const call = currentCall || callRef.current;
        currentCall = null;
        callRef.current = null;

        if (call) {
          try {
            if (call.meetingState && call.meetingState() !== "left-meeting") {
              console.log("[OfficeRoomPage] leaving daily");
              await call.leave();
            }
          } catch (err) {
            console.warn("[OfficeRoomPage] Error leaving Daily:", err);
          } finally {
            try {
              call.destroy?.();
              console.log("[OfficeRoomPage] destroyed daily frame");
            } catch (err) {
              console.warn("[OfficeRoomPage] Error destroying Daily:", err);
            }
          }
        }

        // Only leave presence if THIS effect actually joined it
        if (joinedViaThisEffectRef.current) {
          await leaveRoom();
        }
      };

      // Fire and forget (React cleanup must be sync)
      void cleanup();
    };
    // only on id changes (intentional)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div style={{ height: "100dvh", display: "grid" }}>
      <Tabs defaultValue="call">
        <TabsList>
          <TabsTrigger value="call">Call</TabsTrigger>
          <TabsTrigger value="board">Whiteboard</TabsTrigger>
        </TabsList>
        <TabsContent value="call" style={{ height: "calc(100dvh - 60px)" }}>
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        </TabsContent>
        <TabsContent value="board" style={{ height: "calc(100dvh - 60px)" }}>
          <BoardPane roomId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
