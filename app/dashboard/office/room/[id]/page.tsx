'use client';

import * as React from 'react';
import { useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import BoardPane from '@/components/whiteboard/BoardPane';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useOrgPresence } from '@/components/presence/PresenceProvider';
import { RoomSidebar } from '@/components/dashboard/RoomSidebar';
import { trpc } from '@/server/client';

export default function OfficeRoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const router = useRouter();

  const { joinRoom, leaveRoom } = useOrgPresence();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const callRef = useRef<DailyCall | null>(null);

  // Guards against double-mount/double-cleanup in React 18 StrictMode (dev)
  const initRef = useRef(false);
  const devCleanupSkipRef = useRef(0);
  const joinedPresenceRef = useRef(false);

  const tokenMutation = trpc.rtc.getToken.useMutation();

  useEffect(() => {
    if (!roomId) return;

    let aborted = false;
    let createdCall: DailyCall | null = null;

    const join = async () => {
      if (initRef.current) return; // idempotent
      initRef.current = true;

      try {
        // 1) presence
        await joinRoom(roomId);
        joinedPresenceRef.current = true;

        // 2) token+url
        const { token, url } = await tokenMutation.mutateAsync({ roomId });

        if (aborted || callRef.current) return;

        // 3) create Daily frame
        const parent = containerRef.current ?? document.body;
        const call = DailyIframe.createFrame(parent, {
          showLeaveButton: true,
          iframeStyle: { width: '100%', height: '100%', border: '0' },
        });

        createdCall = call;
        callRef.current = call;

        // 4) events
        call.on('left-meeting', async () => {
          try {
            await leaveRoom();
          } finally {
            router.push('/dashboard/office');
          }
        });

        call.on('error', (e) => {
          // optional: surface a toast/UI error
          // eslint-disable-next-line no-console
          console.error('[Daily] error', e);
        });

        // 5) join Daily
        await call.join({ url, token });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[OfficeRoomPage] join failed', e);
        if (!aborted) {
          await leaveRoom().catch(() => {});
          router.push('/dashboard/office');
        }
      }
    };

    void join();

    return () => {
      // In React 18 StrictMode, effects run, clean up, then run again (dev only).
      // Skip the first synthetic cleanup to avoid tearing down a brand-new call.
      if (process.env.NODE_ENV !== 'production') {
        devCleanupSkipRef.current += 1;
        if (devCleanupSkipRef.current === 1) return;
      }

      aborted = true;

      const cleanup = async () => {
        const call = createdCall || callRef.current;
        createdCall = null;
        callRef.current = null;

        if (call) {
          try {
            // If still in a meeting, leave before destroy
            const state = call.meetingState?.();
            if (state && state !== 'left-meeting') {
              await call.leave();
            }
          } catch {
            // ignore
          } finally {
            try {
              call.destroy?.();
            } catch {
              // ignore
            }
          }
        }

        if (joinedPresenceRef.current) {
          await leaveRoom().catch(() => {});
          joinedPresenceRef.current = false;
        }
      };

      void cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]); // keep deps minimal to avoid rejoining

  return (
    <div className="grid lg:grid-cols-[1fr_280px] h-[100dvh]">
      <div className="min-w-0">
        <Tabs defaultValue="call">
          <TabsList>
            <TabsTrigger value="call">Call</TabsTrigger>
            <TabsTrigger value="board">Whiteboard</TabsTrigger>
          </TabsList>

          <TabsContent value="call" style={{ height: 'calc(100dvh - 60px)' }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          </TabsContent>

          <TabsContent value="board" style={{ height: 'calc(100dvh - 60px)' }}>
            <BoardPane roomId={roomId} />
          </TabsContent>
        </Tabs>
      </div>

      <RoomSidebar roomId={roomId} />
    </div>
  );
}
