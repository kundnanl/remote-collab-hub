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

const chanNameOrg = (orgId: string) => `org:${orgId}:office`;
const chanNameRoom = (orgId: string, roomId: string) => `org:${orgId}:room:${roomId}`;

/** Join org-wide presence. Payload is tracked on subscribe. */
export function joinOrgPresence(orgId: string, me: OrgPresenceState) {
  const channel = supabase.channel(chanNameOrg(orgId), {
    config: { presence: { key: me.userId } },
  });

  channel.on('presence', { event: 'sync' }, () => {});
  channel.on('presence', { event: 'join' }, () => {});
  channel.on('presence', { event: 'leave' }, () => {});
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') await channel.track(me);
  });
  return channel;
}

/** Join room presence. Payload is tracked on subscribe. */
export function joinRoomPresence(orgId: string, roomId: string, me: OrgPresenceState) {
  const channel = supabase.channel(chanNameRoom(orgId, roomId), {
    config: { presence: { key: me.userId } },
  });
  channel.on('presence', { event: 'sync' }, () => {});
  channel.on('presence', { event: 'join' }, () => {});
  channel.on('presence', { event: 'leave' }, () => {});
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') await channel.track(me);
  });
  return channel;
}
