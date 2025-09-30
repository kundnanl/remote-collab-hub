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

type PresencePayload = {
  userId?: string;
  name?: string | null;
  imageUrl?: string | null;
  orgId?: string;
  roomId?: string | null;
  status?: "online" | "focus" | "dnd";
  muted?: boolean;
  handRaised?: boolean;
  [key: string]: unknown;
};

type PresenceMeta = {
  payload?: PresencePayload;
  [key: string]: unknown;
};

function presenceToMap(raw: unknown): Map<string, OrgPresenceState> {
  const map = new Map<string, OrgPresenceState>();

  const state = raw as Record<string, { metas?: PresenceMeta[] } | PresenceMeta[] | undefined>;

  for (const [key, obj] of Object.entries(state)) {
    // Supabase’s type says it's an array, but internally it's actually { metas: […] }
    const metas: PresenceMeta[] =
      Array.isArray(obj) ? (obj as PresenceMeta[]) : (obj?.metas ?? []);

    if (!metas.length) continue;
    const meta = metas[metas.length - 1]; // last meta wins
    const payload = meta?.payload ?? {};

    const user: OrgPresenceState = {
      userId: payload.userId ?? key,
      name: payload.name ?? null,
      imageUrl: payload.imageUrl ?? null,
      orgId: (payload.orgId as string) ?? "",
      roomId: payload.roomId ?? null,
      status: payload.status ?? "online",
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
    // eslint-disable-next-line no-console
    console.log('[PresenceProvider] mount org', { orgId, me: initialMe })
    return () => {
      mountedRef.current = false;
      // eslint-disable-next-line no-console
      console.log('[PresenceProvider] unmount')
    };
  }, [orgId, initialMe]);

  // ---------- org presence sync ----------
  const applyOrgPresence = useCallback(() => {
    if (!orgChannelRef.current) return;
    const raw = orgChannelRef.current.presenceState();
    const map = presenceToMap(raw);
    if (!mountedRef.current) return;
    setOrgMembers(map);
    // eslint-disable-next-line no-console
    console.debug('[PresenceProvider] org presence applied', { count: map.size, map })
  }, []);

  // ---------- room presence sync ----------
  const applyRoomPresence = useCallback(async (roomId: string) => {
    if (!roomChannelRef.current) return;
    const raw = roomChannelRef.current.presenceState();
    const next = presenceToMap(raw);

    if (!mountedRef.current) return;

    setRoomMembers(prev => {
      const prevCount = prev.size;
      const nextCount = next.size;

      // eslint-disable-next-line no-console
      console.debug('[PresenceProvider] room presence applied', { roomId, prevCount, nextCount, next })

      // Start session: 0 → 1+
      if (prevCount === 0 && nextCount >= 1) {
        startOrGet.mutateAsync({ roomId })
          .then(res => console.log('[PresenceProvider] startOrGet ok', { roomId, res }))
          .catch(err => console.warn('[PresenceProvider] startOrGet failed', err));
      }

      // End session: 1+ → 0 (with grace period)
      if (prevCount > 0 && nextCount === 0) {
        if (endTimerRef.current) clearTimeout(endTimerRef.current);
        endTimerRef.current = setTimeout(() => {
          endActive.mutateAsync({ roomId })
            .then(res => console.log('[PresenceProvider] endActive ok', { roomId, res }))
            .catch(err => console.warn('[PresenceProvider] endActive failed', err));
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

    const onSync = () => applyOrgPresence();
    const onJoin = () => applyOrgPresence();
    const onLeave = () => applyOrgPresence();

    ch.on("presence", { event: "sync" }, onSync);
    ch.on("presence", { event: "join" }, onJoin);
    ch.on("presence", { event: "leave" }, onLeave);

    return () => {
      // eslint-disable-next-line no-console
      console.log('[PresenceProvider] cleanup org channel')
      ch.unsubscribe();
      orgChannelRef.current = null;
      setOrgMembers(new Map());
    };
  }, [orgId, applyOrgPresence]); // runs once per org

  // ---------- leave room ----------
  const leaveRoom = useCallback(async () => {
    const channel = roomChannelRef.current;
    const roomId = currentRoomId;

    // eslint-disable-next-line no-console
    console.log('[PresenceProvider] leaveRoom called', { roomId })

    if (!channel || !roomId) {
      setRoomMembers(new Map());
      setCurrentRoomId(null);
      return;
    }

    // If last person, close session immediately
    if (roomMembers.size === 1) {
      try {
        const res = await endActive.mutateAsync({ roomId })
        console.log('[PresenceProvider] endActive on single', { roomId, res })
      } catch (e) {
        console.warn('[PresenceProvider] endActive error', e)
      }
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
      console.debug('[PresenceProvider] org track after leave', updatedMe)
    }
  }, [currentRoomId, endActive, me, roomMembers.size]);

  const handleUnload = useCallback(async () => {
    if (roomMembers.size === 1 && currentRoomId) {
      try {
        const res = await endActive.mutateAsync({ roomId: currentRoomId })
        console.log('[PresenceProvider] handleUnload endActive', { roomId: currentRoomId, res })
      } catch (e) {
        console.warn('[PresenceProvider] handleUnload error', e)
      }
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
      console.debug('[PresenceProvider] org track after join', updatedMe)
    }

    if (!roomId) return;

    const ch = joinRoomPresence(orgId, roomId, updatedMe);
    roomChannelRef.current = ch;

    const onSync = () => applyRoomPresence(roomId);
    const onJoin = () => applyRoomPresence(roomId);
    const onLeave = () => applyRoomPresence(roomId);

    ch.on("presence", { event: "sync" }, onSync);
    ch.on("presence", { event: "join" }, onJoin);
    ch.on("presence", { event: "leave" }, onLeave);

    // Initial sync (slight delay so state is populated)
    setTimeout(onSync, 150);

    // attach global handlers (idempotent because we clean on leave)
    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibility);

    // eslint-disable-next-line no-console
    console.log('[PresenceProvider] joined room', { roomId })
  }, [applyRoomPresence, currentRoomId, leaveRoom, orgId, me, handleUnload, handleVisibility]);

  // ---------- set status ----------
  const setStatus = useCallback(async (status: OrgPresenceState["status"]) => {
    const updatedMe = { ...me, status };
    setMe(updatedMe);

    if (orgChannelRef.current) {
      await orgChannelRef.current.track(updatedMe);
      console.debug('[PresenceProvider] org track status', updatedMe)
    }
    if (roomChannelRef.current) {
      await roomChannelRef.current.track(updatedMe);
      console.debug('[PresenceProvider] room track status', updatedMe)
    }
  }, [me]);

  // ---------- connection recovery ----------
  useEffect(() => {
    const channel = supabase
      .channel("connection-monitor")
      .on("system", { event: "recovered" }, async () => {
        console.log('[PresenceProvider] realtime recovered, retracking')
        if (orgChannelRef.current) await orgChannelRef.current.track(me);
        if (roomChannelRef.current) await roomChannelRef.current.track(me);
      })
      .on("system", { event: "reconnect" }, async () => {
        console.log('[PresenceProvider] realtime reconnect, retracking')
        if (orgChannelRef.current) await orgChannelRef.current.track(me);
        if (roomChannelRef.current) await roomChannelRef.current.track(me);
      })
      .subscribe((status) => {
        console.log('[PresenceProvider] connection-monitor status', status)
      });

    return () => {
      console.log('[PresenceProvider] connection-monitor unsubscribe')
      channel.unsubscribe();
    };
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
