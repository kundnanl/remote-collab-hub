import { trpc } from "@/server/client";

export function useRooms(officeId: string) {
  return trpc.office.listRooms.useQuery({ officeId });
}

export function useCreateRoom() {
  return trpc.office.createRoom.useMutation();
}
