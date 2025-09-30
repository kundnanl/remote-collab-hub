// components/presence/PresenceProvider.tsx
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

  // FIX: Use state instead of just refs - this was causing stale data
  const [me, setMe] = useState<OrgPresenceState>(initialMe);
  const [orgMembers, setOrgMembers] = useState<Map<string, OrgPresenceState>>(new Map());
  const [roomMembers, setRoomMembers] = useState<Map<string, OrgPresenceState>>(new Map());
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  const meRef = useRef(me);
  const orgChannelRef = useRef<ReturnType<typeof joinOrgPresence> | null>(null);
  const roomChannelRef = useRef<ReturnType<typeof joinRoomPresence> | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    meRef.current = me;
  }, [me]);

  const startOrGet = trpc.rooms.startOrGetActiveSession.useMutation();
  const endActive = trpc.rooms.endActiveSession.useMutation();

  // FIX: Properly sync org presence state
  const applyOrgPresence = useCallback(() => {
    const ch = orgChannelRef.current;
    if (!ch) return;
    
    const state = ch.presenceState() as Record<string, OrgPresenceState[]>;
    const map = new Map<string, OrgPresenceState>();
    
    Object.values(state).flat().forEach(s => {
      map.set(s.userId, s);
    });
    
    setOrgMembers(map);
  }, []);

  // FIX: Better room presence tracking
  const applyRoomPresence = useCallback(async (roomId: string) => {
    const ch = roomChannelRef.current;
    if (!ch) return;

    const state = ch.presenceState() as Record<string, OrgPresenceState[]>;
    const next = new Map<string, OrgPresenceState>();
    Object.values(state).flat().forEach(s => next.set(s.userId, s));

    setRoomMembers(prev => {
      const prevCount = prev.size;
      const nextCount = next.size;

      // Start session: 0 → 1
      if (prevCount === 0 && nextCount === 1) {
        startOrGet.mutateAsync({ roomId }).catch(() => {});
      }

      // End session: 1 → 0 (with grace period)
      if (prevCount > 0 && nextCount === 0) {
        if (endTimerRef.current) clearTimeout(endTimerRef.current);
        endTimerRef.current = setTimeout(() => {
          endActive.mutateAsync({ roomId }).catch(() => {});
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

      return next;
    });
  }, [endActive, push, startOrGet]);

  // FIX: Mount org presence properly
  useEffect(() => {
    const initialState = { ...initialMe, roomId: null };
    setMe(initialState);
    
    const ch = joinOrgPresence(orgId, initialState);
    orgChannelRef.current = ch;
    
    // Listen to all presence events
    ch.on("presence", { event: "sync" }, applyOrgPresence);
    ch.on("presence", { event: "join" }, applyOrgPresence);
    ch.on("presence", { event: "leave" }, applyOrgPresence);
    
    return () => { 
      ch.unsubscribe(); 
      orgChannelRef.current = null;
    };
  }, [orgId, initialMe.userId, applyOrgPresence]);

  const leaveRoom = useCallback(async () => {
    const ch = roomChannelRef.current;
    const roomId = currentRoomId;
    
    if (!ch || !roomId) {
      setRoomMembers(new Map());
      return;
    }

    // If last person, close session
    const currentState = ch.presenceState() as Record<string, OrgPresenceState[]>;
    const currentCount = Object.values(currentState).flat().length;
    
    if (currentCount === 1) {
      try { await endActive.mutateAsync({ roomId }); } catch {}
    }

    await ch.unsubscribe();
    roomChannelRef.current = null;
    setCurrentRoomId(null);
    setRoomMembers(new Map());

    // Update org presence to show not in room
    const updatedMe = { ...meRef.current, roomId: null };
    setMe(updatedMe);
    
    if (orgChannelRef.current) {
      await orgChannelRef.current.track(updatedMe);
    }
  }, [currentRoomId, endActive]);

  const joinRoom = useCallback(async (roomId: string | null) => {
    if (roomId === currentRoomId) return;
    
    // Leave current room first
    if (roomChannelRef.current) {
      await leaveRoom();
    }

    setCurrentRoomId(roomId);

    // Update presence with new room
    const updatedMe = { ...meRef.current, roomId };
    setMe(updatedMe);
    
    if (orgChannelRef.current) {
      await orgChannelRef.current.track(updatedMe);
    }

    if (!roomId) return;

    // Join new room channel
    const ch = joinRoomPresence(orgId, roomId, updatedMe);
    roomChannelRef.current = ch;
    
    ch.on("presence", { event: "sync" }, () => applyRoomPresence(roomId));
    ch.on("presence", { event: "join" }, () => applyRoomPresence(roomId));
    ch.on("presence", { event: "leave" }, () => applyRoomPresence(roomId));

    // Handle cleanup on page close
    const handleUnload = async () => {
      const state = ch.presenceState() as Record<string, OrgPresenceState[]>;
      const count = Object.values(state).flat().length;
      if (count === 1) {
        try { await endActive.mutateAsync({ roomId }); } catch {}
      }
    };
    
    window.addEventListener("beforeunload", handleUnload);
    const visibilityHandler = () => {
      if (document.visibilityState === "hidden") handleUnload();
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [applyRoomPresence, currentRoomId, leaveRoom, orgId, endActive]);

  const setStatus = useCallback(async (status: OrgPresenceState["status"]) => {
    const updatedMe = { ...meRef.current, status };
    setMe(updatedMe);
    
    if (orgChannelRef.current) await orgChannelRef.current.track(updatedMe);
    if (roomChannelRef.current) await roomChannelRef.current.track(updatedMe);
  }, []);

  // Recover tracks on reconnect
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