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

  useEffect(() => {
    let aborted = false;
    let currentCall: DailyCall | null = null;

    async function joinCall() {
      if (isInitialized || callRef.current) return;

      try {
        console.log('[OfficeRoomPage] joinCall -> presence join', id)
        await joinRoom(id);

        console.log('[OfficeRoomPage] fetching token/url')
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
          console.log('[OfficeRoomPage] left-meeting')
          if (!aborted) {
            await leaveRoom();
            router.push("/dashboard/office");
          }
        });

        call.on("error", (error) => {
          console.error("[OfficeRoomPage] Daily error:", error);
        });

        console.log('[OfficeRoomPage] joining daily', { url })
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

    joinCall();

    return () => {
      aborted = true;
      console.log('[OfficeRoomPage] cleanup useEffect');
      const cleanup = async () => {
        const call = currentCall || callRef.current;
        currentCall = null;
        callRef.current = null;

        if (call) {
          try {
            if (call.meetingState && call.meetingState() !== "left-meeting") {
              console.log('[OfficeRoomPage] leaving daily')
              await call.leave();
            }
          } catch (err) {
            console.warn("[OfficeRoomPage] Error leaving Daily:", err);
          } finally {
            try {
              call.destroy?.();
              console.log('[OfficeRoomPage] destroyed daily frame')
            } catch (err) {
              console.warn("[OfficeRoomPage] Error destroying Daily:", err);
            }
          }
        }

        await leaveRoom();
      };

      // No await in React cleanup; fire and forget
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
