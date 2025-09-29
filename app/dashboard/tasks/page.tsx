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

  // ✅ Convert Date → string
  const safeSprints = sprints.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    startDate: s.startDate ? s.startDate.toISOString() : null,
    endDate: s.endDate ? s.endDate.toISOString() : null,
  }));

  const safeTasks = tasks.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    startDate: t.startDate ? t.startDate.toISOString() : null,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
  }));

  return (
    <div className="p-6">
      <Backlog
        orgId={orgId}
        initialSprints={safeSprints}
        initialTasks={safeTasks}
      />
    </div>
  );
}
