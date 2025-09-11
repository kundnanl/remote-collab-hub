import { trpc } from "@/server/client";

export function useRoomMembers(roomId: string) {
  return trpc.office.getRoomMembers.useQuery({ roomId });
}

export function useJoinRoom() {
  return trpc.office.joinRoom.useMutation();
}

export function useLeaveRoom() {
  return trpc.office.leaveRoom.useMutation();
}

export function useUpdateStatus() {
  return trpc.office.updateStatus.useMutation();
}
