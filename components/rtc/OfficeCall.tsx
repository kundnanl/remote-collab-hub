// components/rtc/OfficeCall.tsx
'use client';

import * as React from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { useOrgPresence } from '@/components/presence/PresenceProvider';
import { trpc } from '@/server/client';

export function OfficeCall({ roomId, hidden = false }: { roomId: string; hidden?: boolean }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const callRef = React.useRef<DailyCall | null>(null);
  const createdRef = React.useRef(false);
  const devCleanupSkipRef = React.useRef(0);

  const { joinRoom, leaveRoom } = useOrgPresence();
  const tokenMutation = trpc.rtc.getToken.useMutation();

  React.useEffect(() => {
    if (!roomId) return;

    let aborted = false;

    const setup = async () => {
      // wait until the container is actually in the DOM
      if (!containerRef.current) return;
      if (createdRef.current) return;
      createdRef.current = true;

      // mark presence
      await joinRoom(roomId);

      // create the Daily frame inside our container
      const call = DailyIframe.createFrame(containerRef.current, {
        showLeaveButton: true,
        iframeStyle: { width: '100%', height: '100%', border: '0' },
      });
      callRef.current = call;

      call.on('error', (e) => {
        // eslint-disable-next-line no-console
        console.error('[Daily] error', e);
      });

      try {
        const { url, token } = await tokenMutation.mutateAsync({ roomId });
        if (aborted) return;

        // More reliable than load() here; keeps iframe mounted across tabs
        await call.join({ url, token });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[OfficeCall] join failed', err);
      }
    };

    void setup();

    return () => {
      // Avoid tearing down immediately in React 18 dev StrictMode
      if (process.env.NODE_ENV !== 'production') {
        devCleanupSkipRef.current += 1;
        if (devCleanupSkipRef.current === 1) return;
      }

      aborted = true;

      const cleanup = async () => {
        try {
          await leaveRoom();
        } catch {}

        const call = callRef.current;
        callRef.current = null;
        createdRef.current = false;

        if (call) {
          try {
            const state = call.meetingState?.();
            if (state && state !== 'left-meeting') await call.leave();
          } catch {}
          try {
            call.destroy?.();
          } catch {}
        }
      };

      void cleanup();
    };
  }, [roomId, joinRoom, leaveRoom, tokenMutation]);

  return (
    <div
      ref={containerRef}
      className={hidden ? 'absolute inset-0 opacity-0 pointer-events-none' : 'absolute inset-0'}
    />
  );
}
