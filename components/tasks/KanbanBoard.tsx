"use client";

import * as React from "react";
import { useEffect, useMemo } from "react";
import { trpc } from "@/server/client";
import type { RouterOutputs } from "@/server/client";
import { Card } from "@/components/ui/card";
import { subscribeTasks } from "@/lib/realtimeTasks";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { NewTaskDialog } from "./NewTaskDialog";
import Column from "@/components/tasks/KanbanColumn";
import TaskCard from "@/components/tasks/TaskCard";

type Board = RouterOutputs["boards"]["getDefault"];
type Task = RouterOutputs["tasks"]["list"][number];

type Props = {
  orgId: string;
  initialBoard: NonNullable<Board>;
  initialTasks: Task[];
};

export default function KanbanBoard({
  orgId,
  initialBoard,
  initialTasks,
}: Props) {
  const utils = trpc.useUtils();

  // Board/columns query
  const boardQ = trpc.boards.getDefault.useQuery(
    { orgId },
    { initialData: initialBoard }
  );

  // Flat tasks query
  const tasksQ = trpc.tasks.list.useQuery(
    { orgId },
    { initialData: initialTasks, refetchOnWindowFocus: false }
  );

  // Realtime sync
  useEffect(() => {
    return subscribeTasks(
      orgId,
      (t) =>
        utils.tasks.list.setData({ orgId }, (old) =>
          old ? (old.some((x) => x.id === t.id) ? old : [...old, t]) : [t]
        ),
      (t) =>
        utils.tasks.list.setData(
          { orgId },
          (old) => old?.map((x) => (x.id === t.id ? t : x)) ?? [t]
        ),
      (t) =>
        utils.tasks.list.setData(
          { orgId },
          (old) => old?.filter((x) => x.id !== t.id) ?? []
        )
    );
  }, [orgId, utils]);

  const columns = boardQ.data?.columns ?? [];

  // Group tasks by columnId
  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const c of columns) map.set(c.id, []);
    (tasksQ.data ?? []).forEach((t) => {
      if (!t.columnId) return;
      const arr = map.get(t.columnId);
      if (arr) arr.push(t);
    });
    for (const [k, arr] of map) {
      map.set(
        k,
        arr
          .slice()
          .sort(
            (a, b) =>
              a.position - b.position || a.createdAt.localeCompare(b.createdAt)
          )
      );
    }
    return map;
  }, [columns, tasksQ.data]);

  const moveMutation = trpc.tasks.move.useMutation({
    onMutate: async (vars) => {
      await utils.tasks.list.cancel({ orgId });
      const prev = utils.tasks.list.getData({ orgId });

      utils.tasks.list.setData({ orgId }, (old) => {
        if (!old) return old;
        const draft = [...old];
        const idx = draft.findIndex((t) => t.id === vars.taskId);
        if (idx === -1) return old;

        const moving = { ...draft[idx], columnId: vars.toColumnId };
        draft.splice(idx, 1);

        // All tasks in the target column
        const targetTasks = draft.filter((t) => t.columnId === vars.toColumnId);
        // Insert task into new spot
        targetTasks.splice(vars.toIndex, 0, moving);

        // Rebuild positions
        const updated = draft
          .filter((t) => t.columnId !== vars.toColumnId)
          .concat(targetTasks.map((t, i) => ({ ...t, position: i })));

        return updated;
      });

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        utils.tasks.list.setData({ orgId }, ctx.prev);
      }
    },

    onSettled: () => {
      // optional background refresh
      utils.tasks.list.invalidate({ orgId });
    },
  });

  const [dragging, setDragging] = React.useState<Task | null>(null);

  function handleDragStart(e: DragStartEvent) {
    const taskId = e.active.id as string;
    const t = tasksQ.data?.find((x) => x.id === taskId);
    setDragging(t ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setDragging(null);
    if (!over) return;

    const taskId = active.id as string;
    const targetId = over.id as string;

    let toColumnId: string | null;
    let toIndex = 0;

    if (targetId.startsWith("col:")) {
      toColumnId = targetId.slice(4);
      toIndex = tasksByColumn.get(toColumnId)?.length ?? 0;
    } else {
      const targetTask = tasksQ.data?.find((t) => t.id === targetId);
      if (!targetTask) return;
      toColumnId = targetTask.columnId ?? null;
      const list = tasksByColumn.get(toColumnId ?? "") ?? [];
      const idx = list.findIndex((t) => t.id === targetId);
      toIndex = idx === -1 ? list.length : idx;
    }

    moveMutation.mutate({ taskId, toColumnId, toIndex });
  }

  // Column droppable
  function ColumnDroppable({
    columnId,
    items,
  }: {
    columnId: string;
    items: Task[];
  }) {
    const { setNodeRef } = useDroppable({ id: `col:${columnId}` });

    return (
      <div ref={setNodeRef} className="min-h-[40px] space-y-2">
        <SortableContext
          items={items.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((t) => (
            <Column.TaskSortable key={`task-${t.id}`} task={t} />
          ))}
        </SortableContext>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tasks — Kanban</h1>
        {columns.length > 0 && (
          <NewTaskDialog orgId={orgId} defaultColumnId={columns[1]?.id} />
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {columns.map((col) => {
            const items = tasksByColumn.get(col.id) ?? [];

            return (
              <Card key={col.id} className="min-w-[320px] max-w-[360px] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-medium">
                    {col.title}
                    <span className="ml-2 text-muted-foreground text-sm">
                      {items.length}
                      {col.wipLimit ? ` / ${col.wipLimit}` : ""}
                    </span>
                  </div>
                  <NewTaskDialog orgId={orgId} defaultColumnId={col.id} small />
                </div>

                <ColumnDroppable columnId={col.id} items={items} />
              </Card>
            );
          })}

          {/* Drag overlay keeps item visible while dragging */}
          <DragOverlay>
            {dragging ? <TaskCard task={dragging} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
