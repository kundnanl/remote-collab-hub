'use client';

import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from "@liveblocks/react/suspense";
import { Loader2 } from "lucide-react";
import DocumentEditorPage from "./DocumentEditorPage";

export default function DocumentEditorLayout({ docId }: { docId: string }) {
  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks/auth">
      <RoomProvider id={docId} initialPresence={{}}>
        <ClientSideSuspense
          fallback={
            <div className="flex items-center justify-center h-screen text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          }
        >
          {() => <DocumentEditorPage docId={docId} />}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
