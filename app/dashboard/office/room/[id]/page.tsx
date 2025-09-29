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
            if (isInitialized || callRef.current) return;

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
                setIsInitialized(true);

                call.on("left-meeting", () => {
                    if (!aborted) router.push("/dashboard/office");
                });

                call.on("error", (error) => {
                    console.error("Daily call error:", error);
                });

                await call.join({ url, token });
            } catch (err) {
                console.error("Failed to join call:", err);
                setIsInitialized(false);
                if (!aborted) router.push("/dashboard/office");
            }
        }

        joinCall();

        return () => {
            aborted = true;

            const cleanup = async () => {
                if (currentCall || callRef.current) {
                    const call = currentCall || callRef.current;
                    if (!call) return; 
                    try {
                        if (call.meetingState() !== "left-meeting") {
                            await call.leave();
                        }
                    } finally {
                        call.destroy();
                        callRef.current = null;
                        currentCall = null;
                    }
                }
            };

            cleanup();
        };
    }, [id, isInitialized, router, tokenMutation]); 

    return (
        <div className="h-screen w-screen flex flex-col">
            <Tabs defaultValue="call" className="flex flex-col flex-1">
                <TabsList className="shrink-0">
                    <TabsTrigger value="call">Call</TabsTrigger>
                    <TabsTrigger value="board">Whiteboard</TabsTrigger>
                </TabsList>

                <TabsContent value="call" className="flex-1 overflow-hidden">
                    <div ref={containerRef} className="w-full h-full" />
                </TabsContent>

                <TabsContent value="board" className="flex-1 overflow-hidden">
                    <BoardPane roomId={id} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
