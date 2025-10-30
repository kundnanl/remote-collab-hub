'use client';

import * as React from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { useOrgPresence } from '@/components/presence/PresenceProvider';
import { trpc } from '@/server/client';
import { useRouter } from 'next/navigation';

export function OfficeCall({ roomId, hidden = false }: { roomId: string; hidden?: boolean }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const callRef = React.useRef<DailyCall | null>(null);
  const createdRef = React.useRef(false);
  const devCleanupSkipRef = React.useRef(0);
  const joinedPresenceRef = React.useRef(false);

  const { joinRoom, leaveRoom } = useOrgPresence();
  const tokenMutation = trpc.rtc.getToken.useMutation();
  const router = useRouter();

  React.useEffect(() => {
    if (!roomId) return;

    let aborted = false;
    let createdCall: DailyCall | null = null;

    const join = async () => {
      if (createdRef.current) return; // prevents double init
      createdRef.current = true;

      try {
        // 1) join presence
        await joinRoom(roomId);
        joinedPresenceRef.current = true;

        // 2) fetch token + url
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

        // 4) handle events
        call.on('left-meeting', async () => {
          try {
            await leaveRoom();
          } finally {
            router.push('/dashboard/office');
          }
        });

        call.on('error', (e) => {
          console.error('[Daily] error', e);
        });

        // 5) join Daily
        await call.join({ url, token });
      } catch (e) {
        console.error('[OfficeCall] join failed', e);
        if (!aborted) {
          await leaveRoom().catch(() => {});
          router.push('/dashboard/office');
        }
      }
    };

    void join();

    return () => {
      // React 18 StrictMode fix — skip synthetic cleanup once in dev
      if (process.env.NODE_ENV !== 'production') {
        devCleanupSkipRef.current += 1;
        if (devCleanupSkipRef.current === 1) return;
      }

      aborted = true;

      const cleanup = async () => {
        const call = createdCall || callRef.current;
        createdCall = null;
        callRef.current = null;
        createdRef.current = false;

        if (call) {
          try {
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
  }, [roomId]); // only run on roomId change

  return (
    <div
      ref={containerRef}
      className={hidden ? 'absolute inset-0 opacity-0 pointer-events-none' : 'absolute inset-0'}
    />
  );
}
