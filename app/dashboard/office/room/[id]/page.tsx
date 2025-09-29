"use client";

import { use, useEffect, useRef } from "react";
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
    const router = useRouter();

    const tokenMutation = trpc.rtc.getToken.useMutation();
    const initializedRef = useRef(false);

    useEffect(() => {
        let aborted = false;
        let currentCall: DailyCall | null = null;

        async function joinCall() {
            if (initializedRef.current || callRef.current) return;
            initializedRef.current = true;

            try {
                const { token, url } = await tokenMutation.mutateAsync({ roomId: id });
                if (aborted || callRef.current) return;

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

                // Add event listeners
                call.on("left-meeting", () => {
                    if (!aborted) router.push("/dashboard/office");
                });

                call.on("error", (error) => {
                    console.error("Daily call error:", error);
                });

                await call.join({ url, token });
            } catch (err) {
                console.error("Failed to join call:", err);
                if (!aborted) router.push("/dashboard/office");
            }
        }

        joinCall();

        return () => {
            aborted = true;
            const cleanup = async () => {
                const call = currentCall || callRef.current;
                if (!call) return;
                try {
                    if (call.meetingState() !== "left-meeting") {
                        await call.leave();
                    }
                } finally {
                    call.destroy();
                    callRef.current = null;
                }
            };
            cleanup();
        };
    }, [id, router, tokenMutation]); 

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