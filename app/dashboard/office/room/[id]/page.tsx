"use client";

import { use, useEffect, useRef, useState } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { useRouter } from "next/navigation";
import BoardPane from "@/components/whiteboard/BoardPane";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { trpc } from "@/server/client";

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

  useEffect(() => {
    let aborted = false;
    let currentCall: DailyCall | null = null;

    async function joinCall() {
      // Prevent duplicate initialization
      if (isInitialized || callRef.current) {
        console.log("Daily call already initialized, skipping");
        return;
      }

      try {
        const { token, url } = await tokenMutation.mutateAsync({ roomId: id });

        // Check again after async operation
        if (aborted || callRef.current) {
          console.log("Call creation aborted or already exists");
          return;
        }

        const parent = containerRef.current ?? document.body;
        const call = DailyIframe.createFrame(parent, {
          showLeaveButton: true,
          iframeStyle: {
            width: "100%",
            height: "100%",
            border: "0",
          },
        });

        currentCall = call;
        callRef.current = call;
        setIsInitialized(true);

        // Add event listeners
        call.on("left-meeting", () => {
          console.log("Left meeting");
          if (!aborted) {
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
          router.push("/dashboard/office");
        }
      }
    }

    joinCall();

    return () => {
      aborted = true;
      
      // Cleanup function
      const cleanup = async () => {
        if (currentCall || callRef.current) {
          const call = currentCall || callRef.current;
          if (!call) return;
          try {
            // Leave the meeting before destroying
            if (call.meetingState() !== "left-meeting") {
              await call.leave();
            }
          } catch (err) {
            console.error("Error leaving call:", err);
          } finally {
            call.destroy();
            callRef.current = null;
            currentCall = null;
          }
        }
      };

      cleanup();
    };
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