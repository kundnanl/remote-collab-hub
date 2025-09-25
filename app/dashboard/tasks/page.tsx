// app/dashboard/tasks/page.tsx
import { auth } from "@clerk/nextjs/server";
import { createCaller } from "@/server";
import TasksShell from "@/components/tasks/TasksShell";
import { redirect } from "next/navigation";

export default async function TasksPage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect("/");

  const caller = await createCaller();
  // preload initial data for fast TTFB
  const [board, tasks, sprints] = await Promise.all([
    caller.boards.getDefault({ orgId }),
    caller.tasks.list({ orgId }),
    caller.sprints.list({ orgId }),
  ]);

  return (
    <TasksShell
      orgId={orgId}
      initialBoard={board ?? { id: "no-board", orgId, name: "Default", createdAt: "", updatedAt: "", columns: [] }}
      initialTasks={tasks}
      initialSprints={sprints}
    />
  );
}
