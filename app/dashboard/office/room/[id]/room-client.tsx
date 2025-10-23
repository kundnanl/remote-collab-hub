// app/dashboard/office/room/[id]/room-client.tsx
'use client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import BoardPane from '@/components/whiteboard/BoardPane';
import * as React from 'react';

export default function OfficeRoom({ roomId }: { roomId: string }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  return (
    <div style={{ height: '100dvh', display: 'grid' }}>
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
  );
}
