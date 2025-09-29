"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  joinOrgPresence,
  joinRoomPresence,
  OrgPresenceState,
} from "@/lib/presence";
import { supabase } from "@/lib/supabaseClient";
import { useCallback } from "react";
import { trpc } from "@/server/client";
import { useSimpleToast } from "@/components/ui/simple-toast";

type Ctx = {
  orgId: string;
  me: OrgPresenceState;
  orgMembers: Map<string, OrgPresenceState>;
  roomMembers: Map<string, OrgPresenceState>; // current room members
  joinRoom: (roomId: string | null) => Promise<void>;
  setStatus: (s: OrgPresenceState["status"]) => Promise<void>;
};

const PresenceCtx = createContext<Ctx | null>(null);
export const usePresence = () => {
  const ctx = useContext(PresenceCtx);
  if (!ctx) throw new Error("PresenceProvider missing");
  return ctx;
};

export function PresenceProvider({
  orgId,
  me,
  children,
}: {
  orgId: string;
  me: OrgPresenceState;
  children: React.ReactNode;
}) {
  const [orgMembers, setOrgMembers] = useState<Map<string, OrgPresenceState>>(
    new Map()
  );
  const [roomMembers, setRoomMembers] = useState<Map<string, OrgPresenceState>>(
    new Map()
  );

  const orgChannelRef = useRef<ReturnType<typeof joinOrgPresence> | null>(null);
  const roomChannelRef = useRef<ReturnType<typeof joinRoomPresence> | null>(
    null
  );
  const currentRoomIdRef = useRef<string | null>(null);
  const meRef = useRef(me);
  const startOrGet = trpc.rooms.startOrGetActiveSession.useMutation();
  const endActive = trpc.rooms.endActiveSession.useMutation();
  const { push } = useSimpleToast();

  const roomCountRef = useRef<number>(0);

  useEffect(() => {
    // org channel
    const ch = joinOrgPresence(orgId, meRef.current);
    orgChannelRef.current = ch;

    const handleSync = () => {
      const state = ch.presenceState() as Record<string, OrgPresenceState[]>;
      const map = new Map<string, OrgPresenceState>();
      Object.values(state)
        .flat()
        .forEach((s) => map.set(s.userId, s));
      setOrgMembers(map);
    };
    ch.on("presence", { event: "sync" }, handleSync);

    return () => {
      ch.unsubscribe();
    };
  }, [orgId]);

  const joinRoom = useCallback(
    async (roomId: string | null) => {
      if (roomChannelRef.current && currentRoomIdRef.current) {
        if (roomCountRef.current === 1) {
          await endActive.mutateAsync({ roomId: currentRoomIdRef.current });
        }
        await roomChannelRef.current.unsubscribe();
        roomChannelRef.current = null;
        roomCountRef.current = 0;
      }

      currentRoomIdRef.current = roomId;

      meRef.current = { ...meRef.current, roomId };
      if (orgChannelRef.current)
        await orgChannelRef.current.track(meRef.current);

      if (!roomId) {
        setRoomMembers(new Map());
        return;
      }

      const ch = joinRoomPresence(orgId, roomId, meRef.current);
      roomChannelRef.current = ch;

      const sync = async () => {
        const state = ch.presenceState() as Record<string, OrgPresenceState[]>;
        const map = new Map<string, OrgPresenceState>();
        Object.values(state)
          .flat()
          .forEach((s) => map.set(s.userId, s));
        const prev = roomMembers;
        setRoomMembers(map);
        const prevIds = new Set([...prev.keys()]);
        const currIds = new Set([...map.keys()]);
        const count = map.size;
        roomCountRef.current = count;

        // if first to enter → start session
        if (count === 1) {
          await startOrGet.mutateAsync({ roomId });
        }
        for (const id of currIds)
          if (!prevIds.has(id) && id !== meRef.current.userId) {
            const u = map.get(id);
            if (u) push(`${u.name ?? "Someone"} joined the room`);
          }

        for (const id of prevIds)
          if (!currIds.has(id) && id !== meRef.current.userId) {
            const u = prev.get(id);
            if (u) push(`${u.name ?? "Someone"} left the room`);
          }
      };
      ch.on("presence", { event: "sync" }, sync);
    },
    [orgId, endActive, startOrGet, push, roomMembers]
  );

  const setStatus = async (status: OrgPresenceState["status"]) => {
    meRef.current = { ...meRef.current, status };
    if (orgChannelRef.current) await orgChannelRef.current.track(meRef.current);
    if (roomChannelRef.current)
      await roomChannelRef.current.track(meRef.current);
  };

  const value = useMemo<Ctx>(
    () => ({
      orgId,
      me: meRef.current,
      orgMembers,
      roomMembers,
      joinRoom,
      setStatus,
    }),
    [orgId, joinRoom, orgMembers, roomMembers]
  );

  useEffect(() => {
    const channel = supabase
      .channel("connection-monitor")
      .on("system", { event: "recovered" }, async () => {
        if (orgChannelRef.current)
          await orgChannelRef.current.track(meRef.current);
        if (roomChannelRef.current)
          await roomChannelRef.current.track(meRef.current);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return <PresenceCtx.Provider value={value}>{children}</PresenceCtx.Provider>;
}
