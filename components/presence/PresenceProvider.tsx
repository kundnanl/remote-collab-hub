'use client'

import * as React from 'react'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { PresenceContextValue, PresenceMeta, MemberPresence, PresenceStatus } from '@/lib/presence-types'
import { useUser, useOrganization, SignedIn } from '@clerk/nextjs'

const PresenceContext = React.createContext<PresenceContextValue | null>(null)

type Props = { children: React.ReactNode; orgId: string }

function dedupeByUserId(metas: MemberPresence[]): MemberPresence[] {
    const map = new Map<string, MemberPresence>()
    for (const m of metas) {
        const prev = map.get(m.userId)
        if (!prev) {
            map.set(m.userId, m)
        } else {
            const prevAt = prev.joinedAt ? Date.parse(prev.joinedAt) : 0
            const curAt = m.joinedAt ? Date.parse(m.joinedAt) : 0
            const sameRoom = prev.roomId === m.roomId
            const chooseCurrent =
                (sameRoom && curAt >= prevAt) ||
                (!sameRoom && (m.roomId && !prev.roomId ? true : false))
            if (chooseCurrent) map.set(m.userId, m)
        }
    }
    return [...map.values()]
}

export function useOrgPresence(): PresenceContextValue {
    const ctx = React.useContext(PresenceContext)
    if (!ctx) throw new Error('useOrgPresence must be used within PresenceProvider')
    return ctx
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
            roomId: lastRoomId,
            joinedAt: lastRoomId ? new Date().toISOString() : null,
        }
    }, [user, organization, orgId])

    // Subscribe + full logging
    useEffect(() => {
        if (!initialSelf) return;

        console.groupCollapsed(`[Presence] init for org ${orgId}`);
        console.log('initialSelf', initialSelf);
        console.groupEnd();

        // If you don’t use RLS auth for realtime, you can remove this line:
        // supabase.realtime.setAuth();

        const ch = supabase.channel(`org:${orgId}:presence`, {
            config: { presence: { key: initialSelf.userId } },
        })
        channelRef.current = ch;

        const computeMembers = () => {
            const state = ch.presenceState() as Record<string, Array<Record<string, unknown>>>;
            const flattened: MemberPresence[] = [];
            for (const [key, metas] of Object.entries(state)) {
                for (const meta of metas) {
                    const m = meta as PresenceMeta & { presence_ref?: string; ref?: string };
                    flattened.push({
                        userId: m.userId,
                        orgId: m.orgId,
                        roomId: m.roomId ?? null,
                        status: m.status,
                        name: m.name ?? null,
                        imageUrl: m.imageUrl ?? null,
                        joinedAt: m.joinedAt ?? null,
                        ref: m.presence_ref ?? m.ref ?? key,
                    });
                }
            }
            return dedupeByUserId(flattened);
        };

        const handleSync = () => {
            setMembers(computeMembers());
            const users = Object.keys(ch.presenceState() ?? {});
            console.log('[Presence] sync →', users.length, 'users:', users);
        };

        // 🔴 Previously you only logged join/leave. Call handleSync so UI updates immediately.
        ch.on('presence', { event: 'sync' }, handleSync);
        ch.on('presence', { event: 'join' }, () => handleSync());
        ch.on('presence', { event: 'leave' }, () => handleSync());

        ch.subscribe(async (status) => {
            console.log('[Presence] subscription status:', status);
            if (status === 'SUBSCRIBED') {
                // small guard to ensure channel is fully ready before tracking
                await new Promise((r) => setTimeout(r, 150));
                await ch.track(initialSelf);

                // ✅ Make sure you see yourself when you’re alone
                setMe(initialSelf);
                setMembers((prev) =>
                    dedupeByUserId([...prev, { ...initialSelf, ref: initialSelf.userId }])
                );
                setReady(true);
            } else if (status === 'CHANNEL_ERROR') {
                console.error('[Presence] Channel error');
            } else if (status === 'TIMED_OUT') {
                console.warn('[Presence] Channel timed out');
            } else if (status === 'CLOSED') {
                console.warn('[Presence] Channel closed');
            }
        });

        return () => {
            console.log('[Presence] cleanup -> untrack/unsubscribe');
            setReady(false);
            (async () => {
                try {
                    await ch.untrack();
                    console.log('[Presence] untracked successfully');
                } catch (e) {
                    console.warn('[Presence] untrack error', e);
                }
                try {
                    await ch.unsubscribe();
                    console.log('[Presence] unsubscribed successfully');
                } catch (e) {
                    console.warn('[Presence] unsubscribe error', e);
                }
            })();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialSelf?.userId, orgId]);

    const updatePresence = useCallback(
        async (patch: Partial<PresenceMeta>) => {
            if (!channelRef.current || !me) return
            const next: PresenceMeta = { ...me, ...patch }
            if (typeof window !== 'undefined') {
                if (next.roomId) localStorage.setItem(lastRoomStorageKey, next.roomId)
                else localStorage.removeItem(lastRoomStorageKey)
            }
            console.log('[Presence] updatePresence', patch)
            await channelRef.current.track(next)
            setMe(next)
        },
        [me, lastRoomStorageKey]
    )

    const setStatus = useCallback(async (s: PresenceStatus) => {
        console.log('[Presence] setStatus', s)
        await updatePresence({ status: s })
    }, [updatePresence])

    const joinRoom = useCallback(async (roomId: string) => {
        console.log('[Presence] joinRoom', roomId)
        await updatePresence({ roomId, joinedAt: new Date().toISOString() })
    }, [updatePresence])

    const leaveRoom = useCallback(async () => {
        console.log('[Presence] leaveRoom')
        await updatePresence({ roomId: null, joinedAt: null })
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
            orgMembers: members,
            roomMembers,
            liveSince,
        }),
        [ready, me, setStatus, joinRoom, leaveRoom, members, roomMembers, liveSince]
    )

    return (
        <SignedIn>
            <PresenceContext.Provider value={value}>
                {children}
            </PresenceContext.Provider>
        </SignedIn>
    )
}
