import { trpc } from "@/server/client";

export function useOffice(organizationId: string) {
  const officeQuery = trpc.office.getOfficeByOrg.useQuery({ organizationId });
  return officeQuery;
}