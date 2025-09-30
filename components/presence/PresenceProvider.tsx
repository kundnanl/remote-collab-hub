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

/** Supabase presence state looks like: { [key: string]: Meta[] }, Meta.payload = your payload */
type PresenceMeta = { payload?: any } & Record<string, any>;
type PresenceStateRaw = Record<string, PresenceMeta[]>;

function presenceToMap(state: PresenceStateRaw): Map<string, OrgPresenceState> {
  const map = new Map<string, OrgPresenceState>();
  for (const [key, metas] of Object.entries(state)) {
    if (!metas || metas.length === 0) continue;
    const meta = metas[metas.length - 1]; // last meta wins
    const payload = (meta && meta.payload) ? meta.payload : {};
    const user: OrgPresenceState = {
      userId: payload.userId ?? key,
      name: payload.name ?? null,
      imageUrl: payload.imageUrl ?? null,
      orgId: payload.orgId,
      roomId: payload.roomId ?? null,
      status: payload.status ?? 'online',
      muted: payload.muted ?? false,
      handRaised: payload.handRaised ?? false,
    };
    map.set(user.userId, user);
  }
  return map;
}

export function PresenceProvider({
  orgId,
  me: initialMe,
  children,
}: {
  orgId: string;
  me: OrgPresenceState;
  children: React.ReactNode;
}) {
  const { push } = useSimpleToast();

  const [me, setMe] = useState<OrgPresenceState>(initialMe);
  const [orgMembers, setOrgMembers] = useState<Map<string, OrgPresenceState>>(new Map());
  const [roomMembers, setRoomMembers] = useState<Map<string, OrgPresenceState>>(new Map());
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  const orgChannelRef = useRef<ReturnType<typeof joinOrgPresence> | null>(null);
  const roomChannelRef = useRef<ReturnType<typeof joinRoomPresence> | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // tRPC
  const startOrGet = trpc.rooms.startOrGetActiveSession.useMutation();
  const endActive = trpc.rooms.endActiveSession.useMutation();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ---------- org presence sync ----------
  const applyOrgPresence = useCallback(() => {
    if (!orgChannelRef.current) return;
    const state = orgChannelRef.current.presenceState() as PresenceStateRaw;
    if (!mountedRef.current) return;
    setOrgMembers(presenceToMap(state));
  }, []);

  // ---------- room presence sync ----------
  const applyRoomPresence = useCallback(async (roomId: string) => {
    if (!roomChannelRef.current) return;
    const state = roomChannelRef.current.presenceState() as PresenceStateRaw;
    const next = presenceToMap(state);

    if (!mountedRef.current) return;

    setRoomMembers(prev => {
      const prevCount = prev.size;
      const nextCount = next.size;

      // Start session: 0 → 1+
      if (prevCount === 0 && nextCount >= 1) {
        startOrGet.mutateAsync({ roomId }).catch(() => { });
      }

      // End session: 1+ → 0 (with grace period)
      if (prevCount > 0 && nextCount === 0) {
        if (endTimerRef.current) clearTimeout(endTimerRef.current);
        endTimerRef.current = setTimeout(() => {
          endActive.mutateAsync({ roomId }).catch(() => { });
        }, 5000);
      }

      // Toast notifications
      const prevIds = new Set([...prev.keys()]);
      const currIds = new Set([...next.keys()]);
      for (const id of currIds) {
        if (!prevIds.has(id) && id !== me.userId) {
          const u = next.get(id);
          if (u) push(`${u.name ?? "Someone"} joined the room`);
        }
      }
      for (const id of prevIds) {
        if (!currIds.has(id) && id !== me.userId) {
          const u = prev.get(id);
          if (u) push(`${u.name ?? "Someone"} left the room`);
        }
      }

      return next;
    });
  }, [me.userId, push, startOrGet, endActive]);

  // ---------- mount org presence (PERSISTENT IN LAYOUT) ----------
  useEffect(() => {
    const initialState = { ...me, roomId: null };
    setMe(initialState);

    const ch = joinOrgPresence(orgId, initialState);
    orgChannelRef.current = ch;

    ch.on("presence", { event: "sync" }, applyOrgPresence);
    ch.on("presence", { event: "join" }, applyOrgPresence);
    ch.on("presence", { event: "leave" }, applyOrgPresence);

    return () => {
      ch.unsubscribe();
      orgChannelRef.current = null;
      setOrgMembers(new Map());
    };
  }, [orgId, applyOrgPresence]); // runs once per org

  // ---------- leave room ----------
  const leaveRoom = useCallback(async () => {
    const channel = roomChannelRef.current;
    const roomId = currentRoomId;

    if (!channel || !roomId) {
      setRoomMembers(new Map());
      setCurrentRoomId(null);
      return;
    }

    // If last person, close session immediately
    if (roomMembers.size === 1) {
      try { await endActive.mutateAsync({ roomId }); } catch { }
    }

    await channel.unsubscribe();
    roomChannelRef.current = null;

    // remove listeners
    window.removeEventListener("beforeunload", handleUnload);
    document.removeEventListener("visibilitychange", handleVisibility);

    setCurrentRoomId(null);
    setRoomMembers(new Map());

    const updatedMe = { ...me, roomId: null };
    setMe(updatedMe);
    if (orgChannelRef.current) {
      await orgChannelRef.current.track(updatedMe);
    }
  }, [currentRoomId, endActive, me, roomMembers.size]);

  const handleUnload = useCallback(async () => {
    if (roomMembers.size === 1 && currentRoomId) {
      try { await endActive.mutateAsync({ roomId: currentRoomId }); } catch { }
    }
  }, [roomMembers.size, currentRoomId, endActive]);

  const handleVisibility = useCallback(() => {
    if (document.visibilityState === "hidden") {
      handleUnload();
    }
  }, [handleUnload]);

  // ---------- join room ----------
  const joinRoom = useCallback(async (roomId: string | null) => {
    if (roomId === currentRoomId) return;

    // Switch: ensure previous channel is cleaned
    if (roomChannelRef.current) {
      await leaveRoom();
    }

    setCurrentRoomId(roomId);

    const updatedMe = { ...me, roomId };
    setMe(updatedMe);

    if (orgChannelRef.current) {
      await orgChannelRef.current.track(updatedMe);
    }

    if (!roomId) return;

    const ch = joinRoomPresence(orgId, roomId, updatedMe);
    roomChannelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => applyRoomPresence(roomId));
    ch.on("presence", { event: "join" }, () => applyRoomPresence(roomId));
    ch.on("presence", { event: "leave" }, () => applyRoomPresence(roomId));

    // Initial sync (slight delay so state is populated)
    setTimeout(() => applyRoomPresence(roomId), 120);

    // attach global handlers
    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibility);
  }, [applyRoomPresence, currentRoomId, leaveRoom, orgId, me, handleUnload, handleVisibility]);

  // ---------- set status ----------
  const setStatus = useCallback(async (status: OrgPresenceState["status"]) => {
    const updatedMe = { ...me, status };
    setMe(updatedMe);

    if (orgChannelRef.current) {
      await orgChannelRef.current.track(updatedMe);
    }
    if (roomChannelRef.current) {
      await roomChannelRef.current.track(updatedMe);
    }
  }, [me]);

  // ---------- connection recovery ----------
  useEffect(() => {
    const channel = supabase
      .channel("connection-monitor")
      .on("system", { event: "recovered" }, async () => {
        if (orgChannelRef.current) await orgChannelRef.current.track(me);
        if (roomChannelRef.current) await roomChannelRef.current.track(me);
      })
      .on("system", { event: "reconnect" }, async () => {
        if (orgChannelRef.current) await orgChannelRef.current.track(me);
        if (roomChannelRef.current) await roomChannelRef.current.track(me);
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [me]);

  const value = useMemo<Ctx>(() => ({
    orgId,
    me,
    orgMembers,
    roomMembers,
    currentRoomId,
    joinRoom,
    leaveRoom,
    setStatus,
  }), [orgId, me, orgMembers, roomMembers, currentRoomId, joinRoom, leaveRoom, setStatus]);

  return <PresenceCtx.Provider value={value}>{children}</PresenceCtx.Provider>;
}
