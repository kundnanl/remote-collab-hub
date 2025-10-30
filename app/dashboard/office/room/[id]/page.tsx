'use client';
import * as React from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BoardPane from '@/components/whiteboard/BoardPane';
import { RoomSidebar } from '@/components/dashboard/RoomSidebar';
import { OfficeCall } from '@/components/rtc/OfficeCall';
import { useOrgPresence } from '@/components/presence/PresenceProvider';

export default function OfficeRoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const [tab, setTab] = React.useState<'call' | 'board'>('call');
  const { joinRoom, leaveRoom, setPage } = useOrgPresence();

  React.useEffect(() => {
    if (!roomId) return;
    joinRoom(roomId);
    setPage('office');
    return () => {
      leaveRoom();
      setPage(null);
    };
  }, [roomId]);

  const handleTabChange = React.useCallback((value: string) => {
    if (value === 'call' || value === 'board') setTab(value);
  }, []);

  return (
    <div className="grid lg:grid-cols-[1fr_280px] h-[100dvh]">
      <div className="min-w-0 flex flex-col">
        <div className="flex items-center border-b px-4 h-12">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="call">Call</TabsTrigger>
              <TabsTrigger value="board">Whiteboard</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="relative flex-1">
          <OfficeCall roomId={roomId} hidden={tab !== 'call'} />
          <div
            className={
              tab === 'board'
                ? 'absolute inset-0'
                : 'absolute inset-0 opacity-0 pointer-events-none'
            }
            aria-hidden={tab !== 'board'}
          >
            <BoardPane roomId={roomId} />
          </div>
        </div>
      </div>

      <RoomSidebar roomId={roomId} />
    </div>
  );
}
