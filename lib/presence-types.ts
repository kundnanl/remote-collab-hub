// lib/presence-types.ts

export type PresenceStatus = 'online' | 'away' | 'dnd';

export type PresenceMeta = {
  userId: string;
  orgId: string;
  roomId: string | null;
  status: PresenceStatus;
  name?: string | null;
  imageUrl?: string | null;
  joinedAt?: string | null; // ISO time when user joined current room
};

export type MemberPresence = PresenceMeta & { ref: string }; // ref = Supabase presence meta ref

export type PresenceContextValue = {
  ready: boolean;
  me: PresenceMeta | null;
  setStatus: (s: PresenceStatus) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  orgMembers: MemberPresence[]; // all metas in org channel
  roomMembers: (roomId: string) => MemberPresence[];
  liveSince: (roomId: string) => Date | null;
};
