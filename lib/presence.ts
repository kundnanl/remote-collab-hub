import { supabase } from './supabaseClient'

export type UserStatus = 'online' | 'focus' | 'dnd'

export type OrgPresenceState = {
  userId: string
  name: string | null
  imageUrl: string | null
  orgId: string
  roomId: string | null
  status: UserStatus
  muted?: boolean
  handRaised?: boolean
}

const chanNameOrg  = (orgId: string)            => `org:${orgId}:office`
const chanNameRoom = (orgId: string, r: string)  => `org:${orgId}:room:${r}`

/** Join org-wide presence. Payload is tracked on subscribe. */
export function joinOrgPresence(orgId: string, me: OrgPresenceState) {
  const name = chanNameOrg(orgId)
  // eslint-disable-next-line no-console
  console.log('[presence] joinOrgPresence ->', name, me)

  const channel = supabase.channel(name, {
    config: { presence: { key: me.userId } },
  })

  channel.on('presence', { event: 'sync' }, () => {
    // eslint-disable-next-line no-console
    console.debug('[presence] org sync', name, channel.presenceState())
  })
  channel.on('presence', { event: 'join' }, (p) => {
    // eslint-disable-next-line no-console
    console.debug('[presence] org join', name, p)
  })
  channel.on('presence', { event: 'leave' }, (p) => {
    // eslint-disable-next-line no-console
    console.debug('[presence] org leave', name, p)
  })

  channel.subscribe(async (status) => {
    // eslint-disable-next-line no-console
    console.log('[presence] org subscribe status', name, status)
    if (status === 'SUBSCRIBED') {
      try {
        await channel.track(me)
        // eslint-disable-next-line no-console
        console.log('[presence] org track ok', name, me)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[presence] org track failed', e)
      }
    }
  })

  return channel
}

/** Join room presence. Payload is tracked on subscribe. */
export function joinRoomPresence(orgId: string, roomId: string, me: OrgPresenceState) {
  const name = chanNameRoom(orgId, roomId)
  // eslint-disable-next-line no-console
  console.log('[presence] joinRoomPresence ->', name, me)

  const channel = supabase.channel(name, {
    config: { presence: { key: me.userId } },
  })

  channel.on('presence', { event: 'sync' }, () => {
    // eslint-disable-next-line no-console
    console.debug('[presence] room sync', name, channel.presenceState())
  })
  channel.on('presence', { event: 'join' }, (p) => {
    // eslint-disable-next-line no-console
    console.debug('[presence] room join', name, p)
  })
  channel.on('presence', { event: 'leave' }, (p) => {
    // eslint-disable-next-line no-console
    console.debug('[presence] room leave', name, p)
  })

  channel.subscribe(async (status) => {
    // eslint-disable-next-line no-console
    console.log('[presence] room subscribe status', name, status)
    if (status === 'SUBSCRIBED') {
      try {
        await channel.track(me)
        // eslint-disable-next-line no-console
        console.log('[presence] room track ok', name, me)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[presence] room track failed', e)
      }
    }
  })

  return channel
}
