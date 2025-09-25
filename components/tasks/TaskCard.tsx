"use client";

import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RouterOutputs } from "@/server/client";
import { Badge } from "@/components/ui/badge";

type Task = RouterOutputs["tasks"]["list"][number];

const priorityColor: Record<string, string> = {
  LOW: "bg-muted text-foreground",
  MEDIUM: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  HIGH: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  URGENT: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200",
};

export default function TaskCard({ task }: { task: Task }) {
  const pClass = priorityColor[task.priority] ?? "bg-muted";
  return (
    <Card className="p-3 hover:bg-accent/50 cursor-grab active:cursor-grabbing">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="font-medium leading-snug">{task.title}</div>
        <Badge className={pClass}>{task.priority?.toLowerCase() ?? "backlog"}</Badge>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {task.estimate ? `${task.estimate} pts` : ""}
        </div>
        {task.assigneeId ? (
          <Avatar className="h-6 w-6">
            <AvatarImage src={undefined} />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        ) : (
          <div className="text-xs text-muted-foreground">Unassigned</div>
        )}
      </div>
    </Card>
  );
}
