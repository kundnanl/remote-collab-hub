import { SprintList } from "@/components/sprints/SprintList";
import { getServerAuthSession } from "@/lib/auth";

export default async function SprintPage({ params }: { params: { orgId: string } }) {
  const { orgId } = params;

  return (
    <div className="p-6">
      <SprintList orgId={orgId} />
    </div>
  );
}
