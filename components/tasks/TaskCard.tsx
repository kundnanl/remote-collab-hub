"use client";

import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RouterOutputs } from "@/server/client";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

type Task = RouterOutputs["tasks"]["list"][number];

const priorityColor: Record<string, string> = {
  LOW: "bg-muted text-foreground",
  MEDIUM:
    "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  HIGH:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  URGENT:
    "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200",
};

export default function TaskCard({
  task,
  onClick,
  disableClick,
  dragHandleProps,
}: {
  task: Task;
  onClick?: (id: string) => void;
  disableClick?: boolean;
  dragHandleProps?: {
    attributes: DraggableAttributes;
    listeners: SyntheticListenerMap | undefined;
  };
}) {
  const pClass = priorityColor[task.priority] ?? "bg-muted";

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent click if disabled or if clicking on drag handle
    if (disableClick || (e.target as HTMLElement).closest('[data-drag-handle]')) {
      return;
    }
    onClick?.(task.id);
  };

  return (
    <Card className="p-3 hover:bg-accent/50 group">
      <div className="flex items-start gap-2">
        {/* Drag handle - isolated from click events */}
        <div 
          data-drag-handle
          className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted/80 text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0"
          {...dragHandleProps?.attributes}
          {...dragHandleProps?.listeners}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        
        {/* Clickable content area */}
        <div 
          className="flex-1 cursor-pointer" 
          onClick={handleCardClick}
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="font-medium leading-snug flex-1">
              {task.title}
            </div>
            <Badge className={pClass}>
              {task.priority?.toLowerCase() ?? "backlog"}
            </Badge>
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
        </div>
      </div>
    </Card>
  );
}