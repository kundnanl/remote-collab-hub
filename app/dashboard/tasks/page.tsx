import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createCaller } from "@/server";
import Backlog from "@/components/tasks/Backlog";
import Board from "@/components/tasks/Board";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  // Await searchParams before using it
  const resolvedParams = await searchParams;
  const tabParam = resolvedParams?.tab;
  const tab = tabParam === "board" ? "board" : "backlog";

  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect("/");

  const caller = await createCaller();
  
  // Ensure a default board + columns exist
  const board = await caller.boards.createDefaultIfMissing({ orgId });

  // Fetch data for both tabs (SSR-primed)
  const [sprints, tasks] = await Promise.all([
    caller.sprints.list({ orgId }),
    caller.tasks.list({ orgId }),
  ]);

  // Date-safe serializations
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

  const initialBoard = {
    ...board!,
    createdAt: board!.createdAt.toISOString(),
    updatedAt: board!.updatedAt.toISOString(),
    columns: board!.columns.map((c) => ({ ...c })),
  };

  // counts (rough, server-side snapshot)
  const activeSprintIds = new Set(safeSprints.filter((s) => s.status === "ACTIVE").map((s) => s.id));
  const boardCount = safeTasks.filter((t) => t.sprintId && activeSprintIds.has(t.sprintId ?? "")).length;
  const backlogCount = safeTasks.filter((t) => !t.sprintId).length;

  return (
    <div className="p-6">
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Workspace</div>
        <h1 className="text-2xl font-semibold">Tasks</h1>
      </div>

      <Tabs defaultValue={tab} className="w-full">
        <TabsList>
          <TabsTrigger value="backlog">
            Backlog
            <span className="ml-2 text-xs text-muted-foreground">({backlogCount})</span>
          </TabsTrigger>
          <TabsTrigger value="board">
            Board
            <span className="ml-2 text-xs text-muted-foreground">({boardCount})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backlog" className="mt-6">
          <Backlog orgId={orgId} initialSprints={safeSprints} initialTasks={safeTasks} />
        </TabsContent>

        <TabsContent value="board" className="mt-6">
          <Board orgId={orgId} initialBoard={initialBoard} initialTasks={safeTasks} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
