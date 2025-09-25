import { trpc } from "@/server/client";

export function useRooms(officeId: string) {
  console.log(officeId)
  return trpc.office.listRooms.useQuery({ organizationId: officeId });
}

export function useCreateRoom() {
  return trpc.office.createRoom.useMutation();
}
