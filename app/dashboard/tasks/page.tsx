// app/dashboard/tasks/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createCaller } from "@/server";
import Backlog from "@/components/tasks/Backlog";

export default async function TasksBacklogPage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect("/");

  const caller = await createCaller();
  const [sprints, tasks] = await Promise.all([
    caller.sprints.list({ orgId }),
    caller.tasks.list({ orgId }),
  ]);

  return (
    <div className="p-6">
      <Backlog orgId={orgId} initialSprints={sprints} initialTasks={tasks} />
    </div>
  );
}
