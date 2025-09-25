import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createCaller } from "@/server";
import KanbanBoard from "@/components/tasks/KanbanBoard";

export default async function TasksBoardPage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect("/");

  const caller = await createCaller();

  // Ensure default board/columns exist (idempotent)
  const board = await caller.boards.createDefaultIfMissing({ orgId });
  if (!board) redirect("/");

  // Preload tasks to hydrate the client query cache
  const initialTasks = await caller.tasks.list({ orgId });

  return (
    <KanbanBoard
      orgId={orgId}
      initialBoard={board}
      initialTasks={initialTasks}
    />
  );
}
