// components/tasks/TasksShell.tsx
"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { RouterOutputs } from "@/server/client";
import KanbanBoard from "@/components/tasks/KanbanBoard"; // your existing Kanban (fixed one)
import { SprintPanel } from "@/components/tasks/SprintPanel";
import { Card } from "@/components/ui/card";

type Board = RouterOutputs["boards"]["getDefault"];
type Task = RouterOutputs["tasks"]["list"][number];
type Sprint = RouterOutputs["sprints"]["list"][number];

export default function TasksShell({
  orgId,
  initialBoard,
  initialTasks,
  initialSprints,
}: {
  orgId: string;
  initialBoard: NonNullable<Board>;
  initialTasks: Task[];
  initialSprints: Sprint[];
}) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tasks</h1>
      </div>

      <Tabs defaultValue="board" className="w-full">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="sprints">Sprints</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          <KanbanBoard
            orgId={orgId}
            initialBoard={initialBoard}
            initialTasks={initialTasks}
          />
        </TabsContent>

        <TabsContent value="sprints" className="mt-4">
          <SprintPanel orgId={orgId} initialSprints={initialSprints} />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <Card className="p-6 text-muted-foreground">
            Reports coming soon: burndown, velocity, sprint summaries.
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
