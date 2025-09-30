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

  // tRPC
  const startOrGet = trpc.rooms.startOrGetActiveSession.useMutation();
  const endActive = trpc.rooms.endActiveSession.useMutation();

  // ---------- org presence sync ----------
  const applyOrgPresence = useCallback(() => {
    if (!orgChannelRef.current) return;
    const state = orgChannelRef.current.presenceState() as Record<string, OrgPresenceState[]>;
    const map = new Map<string, OrgPresenceState>();
    Object.values(state).flat().forEach(s => {
      map.set(s.userId, s);
    });
    setOrgMembers(map);
  }, []);

  // ---------- room presence sync ----------
  const applyRoomPresence = useCallback(async (roomId: string) => {
    if (!roomChannelRef.current) return;
    const state = roomChannelRef.current.presenceState() as Record<string, OrgPresenceState[]>;
    const next = new Map<string, OrgPresenceState>();
    Object.values(state).flat().forEach(s => {
      next.set(s.userId, s);
    });

    setRoomMembers(prev => {
      const prevCount = prev.size;
      const nextCount = next.size;

      // Start session: 0 → 1+
      if (prevCount === 0 && nextCount >= 1) {
        startOrGet.mutateAsync({ roomId }).catch(() => {});
      }

      // End session: 1+ → 0 (with grace period)
      if (prevCount > 0 && nextCount === 0) {
        if (endTimerRef.current) clearTimeout(endTimerRef.current);
        endTimerRef.current = setTimeout(() => {
          endActive.mutateAsync({ roomId }).catch(() => {});
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

  // ---------- mount org presence ----------
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
    };
  }, [orgId, applyOrgPresence]);

  // ---------- leave room ----------
  const leaveRoom = useCallback(async () => {
    if (!roomChannelRef.current || !currentRoomId) {
      setRoomMembers(new Map());
      return;
    }

    // If last person, close session immediately
    if (roomMembers.size === 1) {
      try { await endActive.mutateAsync({ roomId: currentRoomId }); } catch {}
    }

    await roomChannelRef.current.unsubscribe();
    roomChannelRef.current = null;
    setCurrentRoomId(null);
    setRoomMembers(new Map());

    const updatedMe = { ...me, roomId: null };
    setMe(updatedMe);
    if (orgChannelRef.current) {
      await orgChannelRef.current.track(updatedMe);
    }
  }, [currentRoomId, endActive, me, roomMembers.size]);

  // ---------- join room ----------
  const joinRoom = useCallback(async (roomId: string | null) => {
    if (roomId === currentRoomId) return;
    
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

    // Cleanup handler
    const handleUnload = async () => {
      if (roomMembers.size === 1) {
        try { await endActive.mutateAsync({ roomId }); } catch {}
      }
    };
    
    window.addEventListener("beforeunload", handleUnload);
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") handleUnload();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Initial sync
    setTimeout(() => applyRoomPresence(roomId), 100);
  }, [applyRoomPresence, currentRoomId, leaveRoom, orgId, endActive, me, roomMembers.size]);

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
        if (orgChannelRef.current) {
          await orgChannelRef.current.track(me);
        }
        if (roomChannelRef.current) {
          await roomChannelRef.current.track(me);
        }
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