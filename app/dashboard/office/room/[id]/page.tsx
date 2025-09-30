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
      if (isInitialized || callRef.current) {
        return;
      }

      try {
        // presence join
        await joinRoom(id);

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
          if (!aborted) {
            await leaveRoom();
            router.push("/dashboard/office");
          }
        });

        call.on("error", (error) => {
          console.error("Daily call error:", error);
        });

        await call.join({ url, token });
      } catch (err) {
        console.error("Failed to join call:", err);
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

  const cleanup = async () => {
    const call = currentCall || callRef.current;
    currentCall = null;
    callRef.current = null;

    if (call) {
      try {
        if (call.meetingState() !== "left-meeting") {
          await call.leave();
        }
      } catch (err) {
        console.warn("Error leaving Daily call:", err);
      } finally {
        try {
          call.destroy();
        } catch (err) {
          console.warn("Error destroying Daily call:", err);
        }
      }
    }

    await leaveRoom();
  };

  cleanup();
};
    // 👇 Only re-run when the room id changes
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
