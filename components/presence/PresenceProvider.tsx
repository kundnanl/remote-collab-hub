// components/presence/PresenceProvider.tsx
'use client'

import * as React from 'react'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { PresenceContextValue, PresenceMeta, MemberPresence, PresenceStatus } from '@/lib/presence-types'
import { useUser, useOrganization, SignedIn } from '@clerk/nextjs'

const PresenceContext = React.createContext<PresenceContextValue | null>(null)

export function useOrgPresence(): PresenceContextValue {
  const ctx = React.useContext(PresenceContext)
  if (!ctx) throw new Error('useOrgPresence must be used within PresenceProvider')
  return ctx
}

type Props = { children: React.ReactNode; orgId: string }

function dedupeByUserId(metas: MemberPresence[]): MemberPresence[] {
  const map = new Map<string, MemberPresence>()
  for (const m of metas) {
    const prev = map.get(m.userId)
    if (!prev) map.set(m.userId, m)
    else {
      const prevAt = prev.joinedAt ? Date.parse(prev.joinedAt) : 0
      const curAt = m.joinedAt ? Date.parse(m.joinedAt) : 0
      const sameRoom = prev.roomId === m.roomId
      const chooseCurrent = (sameRoom && curAt >= prevAt) || (!sameRoom && (m.roomId && !prev.roomId ? true : false))
      if (chooseCurrent) map.set(m.userId, m)
    }
  }
  return [...map.values()]
}

export function PresenceProvider({ children, orgId }: Props) {
  const { user } = useUser()
  const { organization } = useOrganization()
  const [ready, setReady] = useState(false)
  const [me, setMe] = useState<PresenceMeta | null>(null)
  const [members, setMembers] = useState<MemberPresence[]>([])

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const lastRoomStorageKey = `office:lastRoom:${orgId}`

  const initialSelf: PresenceMeta | null = useMemo(() => {
    if (!user || !organization) return null
    const lastRoomId =
      (typeof window !== 'undefined' && localStorage.getItem(lastRoomStorageKey)) || null
    return {
      userId: user.id,
      orgId,
      name: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? 'User',
      imageUrl: user.imageUrl ?? null,
      status: 'online',
      page: null,             // ✨ new — page label is set by each page
      roomId: lastRoomId,
      joinedAt: lastRoomId ? new Date().toISOString() : null,
    }
  }, [user, organization, orgId])

  useEffect(() => {
    if (!initialSelf) return;

    const ch = supabase.channel(`org:${orgId}:presence`, {
      config: { presence: { key: initialSelf.userId } },
    })
    channelRef.current = ch;

    const computeMembers = () => {
      const state = ch.presenceState() as Record<string, Array<Record<string, unknown>>>
      const flattened: MemberPresence[] = []
      for (const [key, metas] of Object.entries(state)) {
        for (const meta of metas) {
          const m = meta as PresenceMeta & { presence_ref?: string; ref?: string };
          flattened.push({
            userId: m.userId,
            orgId: m.orgId,
            roomId: m.roomId ?? null,
            status: m.status,
            page: m.page ?? null,
            name: m.name ?? null,
            imageUrl: m.imageUrl ?? null,
            joinedAt: m.joinedAt ?? null,
            ref: m.presence_ref ?? m.ref ?? key,
          })
        }
      }
      return dedupeByUserId(flattened)
    }

    const handleSync = () => {
      setMembers(computeMembers())
    }

    ch.on('presence', { event: 'sync' }, handleSync)
    ch.on('presence', { event: 'join' }, handleSync)
    ch.on('presence', { event: 'leave' }, handleSync)

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await new Promise((r) => setTimeout(r, 150))
        await ch.track(initialSelf)

        setMe(initialSelf)
        setMembers((prev) => dedupeByUserId([...prev, { ...initialSelf, ref: initialSelf.userId }]))
        setReady(true)
      }
    })

    return () => {
      setReady(false)
        ; (async () => {
          try { await ch.untrack() } catch { }
          try { await ch.unsubscribe() } catch { }
        })()
    }
  }, [initialSelf?.userId, orgId])

const updatePresence = useCallback(
  async (patch: Partial<PresenceMeta>) => {
    if (!channelRef.current || !me) return;

    const next: PresenceMeta = { ...me, ...patch };

    // Prevent re-tracking identical presence states
    if (JSON.stringify(next) === JSON.stringify(me)) return;

    if (typeof window !== 'undefined') {
      if (next.roomId) localStorage.setItem(lastRoomStorageKey, next.roomId);
      else localStorage.removeItem(lastRoomStorageKey);
    }

    await channelRef.current.track(next);
    setMe(next);
  },
  [me, lastRoomStorageKey]
);

  const setStatus = useCallback(async (s: PresenceStatus) => {
    await updatePresence({ status: s })
  }, [updatePresence])

  const joinRoom = useCallback(async (roomId: string) => {
    await updatePresence({ roomId, joinedAt: new Date().toISOString(), page: 'office' })
  }, [updatePresence])

  const leaveRoom = useCallback(async () => {
    await updatePresence({ roomId: null, joinedAt: null })
  }, [updatePresence])

  const setPage = useCallback(async (page: string | null) => {
    await updatePresence({ page })
  }, [updatePresence])

  const roomMembers = useCallback(
    (roomId: string) => members.filter((m) => m.roomId === roomId),
    [members]
  )

  const liveSince = useCallback(
    (roomId: string) => {
      const inRoom = roomMembers(roomId)
      if (inRoom.length === 0) return null
      const times = inRoom
        .map((m) => (m.joinedAt ? Date.parse(m.joinedAt) : Number.POSITIVE_INFINITY))
        .filter((n) => Number.isFinite(n))
      if (!times.length) return null
      return new Date(Math.min(...times))
    },
    [roomMembers]
  )

  const value = useMemo<PresenceContextValue>(
    () => ({
      ready,
      me,
      setStatus,
      joinRoom,
      leaveRoom,
      setPage,          // ✨ exposed
      orgMembers: members,
      roomMembers,
      liveSince,
    }),
    [ready, me, setStatus, joinRoom, leaveRoom, setPage, members, roomMembers, liveSince]
  )

  return (
    <SignedIn>
      <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
    </SignedIn>
  )
}
