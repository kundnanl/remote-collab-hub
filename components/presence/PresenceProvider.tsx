// app/components/presence/PresenceProvider.tsx
"use client";

import React, {
  createContext, useContext, useEffect, useMemo, useRef, useState, useCallback,
} from "react";
import { joinOrgPresence, joinRoomPresence, OrgPresenceState } from "@/lib/presence";
import { supabase } from "@/lib/supabaseClient";
import { trpc } from "@/server/client";
import { useSimpleToast } from "@/components/ui/simple-toast";

type Ctx = {
  orgId: string;
  me: OrgPresenceState;
  orgMembers: Map<string, OrgPresenceState>;
  roomMembers: Map<string, OrgPresenceState>;
  currentRoomId: string | null;
  joinRoom: (roomId: string | null) => Promise<void>;
  leaveRoom: () => Promise<void>;
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
  const { push } = useSimpleToast();

  const [orgMembers, setOrgMembers] = useState<Map<string, OrgPresenceState>>(new Map());
  const [roomMembers, setRoomMembers] = useState<Map<string, OrgPresenceState>>(new Map());
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  const orgMembersRef = useRef(orgMembers);
  const roomMembersRef = useRef(roomMembers);
  const meRef = useRef(me);

  const orgChannelRef = useRef<ReturnType<typeof joinOrgPresence> | null>(null);
  const roomChannelRef = useRef<ReturnType<typeof joinRoomPresence> | null>(null);

  // grace timer to end session when room empties
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // tRPC
  const startOrGet = trpc.rooms.startOrGetActiveSession.useMutation();
  const endActive = trpc.rooms.endActiveSession.useMutation();

  // ---------- helpers ----------
  const applyOrgPresence = useCallback(() => {
    const ch = orgChannelRef.current!;
    const state = ch.presenceState() as Record<string, OrgPresenceState[]>;
    const map = new Map<string, OrgPresenceState>();
    Object.values(state).flat().forEach(s => map.set(s.userId, s));
    orgMembersRef.current = map;
    setOrgMembers(map);
  }, []);

  const applyRoomPresence = useCallback(async (roomId: string) => {
    const ch = roomChannelRef.current!;
    const state = ch.presenceState() as Record<string, OrgPresenceState[]>;
    const next = new Map<string, OrgPresenceState>();
    Object.values(state).flat().forEach(s => next.set(s.userId, s));

    const prev = roomMembersRef.current;
    roomMembersRef.current = next;
    setRoomMembers(next);

    const prevCount = prev.size;
    const nextCount = next.size;

    // Start session: 0 → 1
    if (prevCount === 0 && nextCount === 1) {
      try { await startOrGet.mutateAsync({ roomId }); } catch { }
    }

    // End session: 1 → 0 (with small grace to avoid flaps)
    if (prevCount > 0 && nextCount === 0) {
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      endTimerRef.current = setTimeout(async () => {
        try { await endActive.mutateAsync({ roomId }); } catch { }
      }, 5000);
    }

    // Toast joins/leaves
    const prevIds = new Set([...prev.keys()]);
    const currIds = new Set([...next.keys()]);
    for (const id of currIds) {
      if (!prevIds.has(id) && id !== meRef.current.userId) {
        const u = next.get(id);
        if (u) push(`${u.name ?? "Someone"} joined the room`);
      }
    }
    for (const id of prevIds) {
      if (!currIds.has(id) && id !== meRef.current.userId) {
        const u = prev.get(id);
        if (u) push(`${u.name ?? "Someone"} left the room`);
      }
    }
  }, [endActive, push, startOrGet]);

  // ---------- mount org presence ----------
  useEffect(() => {
    meRef.current = { ...meRef.current, roomId: null };
    const ch = joinOrgPresence(orgId, meRef.current);
    orgChannelRef.current = ch;
    ch.on("presence", { event: "sync" }, applyOrgPresence);
    return () => { ch.unsubscribe(); };
  }, [orgId, applyOrgPresence]);

  // ---------- leave helper ----------
  const leaveRoom = useCallback(async () => {
    if (!roomChannelRef.current || !currentRoomId) {
      setRoomMembers(new Map());
      roomMembersRef.current = new Map();
      return;
    }
    // if last person, close session
    if (roomMembersRef.current.size === 1) {
      try { await endActive.mutateAsync({ roomId: currentRoomId }); } catch { }
    }
    await roomChannelRef.current.unsubscribe();
    roomChannelRef.current = null;
    setCurrentRoomId(null);
    setRoomMembers(new Map());
    roomMembersRef.current = new Map();

    meRef.current = { ...meRef.current, roomId: null };
    if (orgChannelRef.current) await orgChannelRef.current.track(meRef.current);
  }, [currentRoomId, endActive]);

  // ---------- join helper ----------
  // when joining a room
  const joinRoom = useCallback(async (roomId: string | null) => {
    if (roomId === currentRoomId) return;
    if (roomChannelRef.current) await leaveRoom();

    setCurrentRoomId(roomId);

    meRef.current = { ...meRef.current, roomId };
    if (orgChannelRef.current) await orgChannelRef.current.track(meRef.current); // ✅ always reflect org-wide

    if (!roomId) return;

    const ch = joinRoomPresence(orgId, roomId, meRef.current);
    roomChannelRef.current = ch;
    ch.on("presence", { event: "sync" }, () => applyRoomPresence(roomId));

    applyRoomPresence(roomId);
  }, [applyRoomPresence, currentRoomId, leaveRoom, orgId]);

  const setStatus = useCallback(async (status: OrgPresenceState["status"]) => {
    meRef.current = { ...meRef.current, status };
    if (orgChannelRef.current) await orgChannelRef.current.track(meRef.current);
    if (roomChannelRef.current) await roomChannelRef.current.track(meRef.current);
  }, []);

  // recover tracks on reconnect
  useEffect(() => {
    const channel = supabase
      .channel("connection-monitor")
      .on("system", { event: "recovered" }, async () => {
        if (orgChannelRef.current) await orgChannelRef.current.track(meRef.current);
        if (roomChannelRef.current) await roomChannelRef.current.track(meRef.current);
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  const value = useMemo<Ctx>(() => ({
    orgId,
    me: meRef.current,
    orgMembers: orgMembersRef.current,
    roomMembers: roomMembersRef.current,
    currentRoomId,
    joinRoom,
    leaveRoom,
    setStatus,
  }), [orgId, currentRoomId, joinRoom, leaveRoom, setStatus]);

  return <PresenceCtx.Provider value={value}>{children}</PresenceCtx.Provider>;
}
