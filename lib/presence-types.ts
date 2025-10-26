// lib/presence-types.ts

export type PresenceStatus = 'online' | 'away' | 'dnd';

export type PresenceMeta = {
  userId: string;
  orgId: string;
  roomId: string | null;
  status: PresenceStatus;
  page?: string | null;      // 'dashboard' | 'office' | 'docs' | 'tasks' | ...
  name?: string | null;
  imageUrl?: string | null;
  joinedAt?: string | null;  // ISO time when user joined current room
};

export type MemberPresence = PresenceMeta & { ref: string };

export type PresenceContextValue = {
  ready: boolean;
  me: PresenceMeta | null;
  setStatus: (s: PresenceStatus) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  setPage: (page: string | null) => Promise<void>;
  orgMembers: MemberPresence[];
  roomMembers: (roomId: string) => MemberPresence[];
  liveSince: (roomId: string) => Date | null;
};
