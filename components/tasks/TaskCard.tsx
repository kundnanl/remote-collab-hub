"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { RouterOutputs } from "@/server/client";
import { GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

type Task = RouterOutputs["tasks"]["list"][number];

const priorityIcon: Record<string, { icon: any; className: string }> = {
  LOW: { icon: ArrowDown, className: "text-blue-500" },
  MEDIUM: { icon: ArrowUp, className: "text-gray-500" },
  HIGH: { icon: ArrowUp, className: "text-amber-500" },
  URGENT: { icon: ArrowUp, className: "text-red-500" },
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
  const Icon = priorityIcon[task.priority]?.icon ?? ArrowUp;
  const iconClass = priorityIcon[task.priority]?.className ?? "text-gray-400";

  const handleClick = (e: React.MouseEvent) => {
    if (disableClick || (e.target as HTMLElement).closest("[data-drag-handle]")) return;
    onClick?.(task.id);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-2 py-2 rounded-md border-b cursor-pointer group",
        "hover:bg-accent/50 transition-colors"
      )}
      onClick={handleClick}
    >
      {/* Drag Handle */}
      <div
        data-drag-handle
        className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted/70 text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0"
        {...dragHandleProps?.attributes}
        {...dragHandleProps?.listeners}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Title + Metadata */}
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", iconClass)} />
          <span className="font-medium text-sm truncate">{task.title}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {task.estimate && <span>{task.estimate} pts</span>}
          <span>{task.columnId ?? "Backlog"}</span>
        </div>
      </div>

      {/* Assignee */}
      {task.assigneeId ? (
        <Avatar className="h-6 w-6">
          <AvatarImage src={undefined} />
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
      ) : (
        <span className="text-xs text-muted-foreground">Unassigned</span>
      )}
    </div>
  );
}
