import { supabase } from './supabaseClient'

export type UserStatus = 'online' | 'focus' | 'dnd';

export type OrgPresenceState = {
  userId: string;
  name: string | null;
  imageUrl: string | null;
  orgId: string;
  roomId: string | null;
  status: UserStatus;
  muted?: boolean;
  handRaised?: boolean;
};

const chanNameOrg = (orgId: string) => `org:${orgId}:office`
const chanNameRoom = (orgId: string, roomId: string) => `org:${orgId}:room:${roomId}`

export function joinOrgPresence(orgId: string, me: OrgPresenceState) {
  const channel = supabase.channel(chanNameOrg(orgId), {
    config: { presence: { key: me.userId } }
  })
  channel.on('presence', { event: 'sync' }, () => {/* consumer handles getPresence() */})
  channel.on('presence', { event: 'join' }, () => {/* consumer updates */})
  channel.on('presence', { event: 'leave' }, () => {/* consumer updates */})
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') await channel.track(me)
  })
  return channel
}

export function joinRoomPresence(orgId: string, roomId: string, me: OrgPresenceState) {
  const channel = supabase.channel(chanNameRoom(orgId, roomId), {
    config: { presence: { key: me.userId } }
  })
  channel.on('presence', { event: 'sync' }, () => {/* consumer updates */})
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') await channel.track(me)
  })
  return channel
}
