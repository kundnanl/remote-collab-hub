"use client";

import * as React from "react";
import { trpc } from "@/server/client";
import type { RouterOutputs } from "@/server/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DndContext,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  defaultAnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/Skeleton";

type BoardType = RouterOutputs["boards"]["getDefault"];
type Task = RouterOutputs["tasks"]["list"][number];

/* ---------------------------- Skeleton (Board) ---------------------------- */

export function BoardSkeleton() {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-4 min-w-max">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="w-[320px] p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-10" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((__, k) => (
                <Skeleton key={k} className="h-16 w-full rounded-md" />
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-16 rounded-md" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- Utils -------------------------------- */

function useTasksByColumn(tasks: Task[]) {
  return React.useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const key = t.columnId ?? "none";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    for (const [k, arr] of map) {
      map.set(
        k,
        arr
          .slice()
          .sort(
            (a, b) =>
              a.position - b.position ||
              +new Date(a.createdAt) - +new Date(b.createdAt)
          )
      );
    }
    return map;
  }, [tasks]);
}

/* ----------------------------- Task (Lite UI) ---------------------------- */

function TaskCardLite({
  task,
  onClick,
  dragHandleProps,
  disabled,
}: {
  task: Task;
  onClick?: (id: string) => void;
  dragHandleProps?: any;
  disabled?: boolean;
}) {
  return (
    <button
      className={cn(
        "w-full text-left rounded-md border p-2 bg-card hover:bg-muted/40 cursor-grab active:cursor-grabbing transition-shadow shadow-sm hover:shadow",
        disabled && "opacity-60"
      )}
      onClick={() => onClick?.(task.id)}
      {...dragHandleProps}
    >
      <div className="text-sm font-medium line-clamp-2">{task.title}</div>
      <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{task.type.toLowerCase()}</Badge>
        <Badge>{task.priority.toLowerCase()}</Badge>
      </div>
    </button>
  );
}

function SortableTask({
  task,
  onClick,
}: {
  task: Task;
  onClick: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    animateLayoutChanges: (args) => {
      if (args.isDragging || args.wasDragging) return false;
      return defaultAnimateLayoutChanges(args);
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "transform 0.12s ease" : transition,
    willChange: "transform",
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={false}
      animate={{
        scale: isDragging ? 1.03 : 1,
        boxShadow: isDragging
          ? "0 10px 24px rgba(0,0,0,0.12)"
          : "0 1px 2px rgba(0,0,0,0.05)",
      }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
    >
      <TaskCardLite
        task={task}
        onClick={onClick}
        dragHandleProps={{ ...attributes, ...listeners }}
        disabled={isDragging}
      />
    </motion.div>
  );
}

/* ----------------------------- Column Drop UI ---------------------------- */

function ColumnDroppable({
  columnId,
  children,
}: {
  columnId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${columnId}` });

  return (
    <motion.div
      ref={setNodeRef}
      className="min-h-[16px] space-y-2 rounded-lg relative"
      animate={{
        outlineColor: isOver ? "rgba(34,197,94,0.7)" : "transparent",
        outlineWidth: isOver ? 2 : 0,
      }}
      transition={{ duration: 0.18 }}
      style={{ outlineStyle: "solid" }}
    >
      <AnimatePresence>
        {isOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.08 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-lg bg-emerald-400 pointer-events-none"
          />
        )}
      </AnimatePresence>
      {children}
    </motion.div>
  );
}

/* --------------------------------- Board -------------------------------- */

export default function Board({
  orgId,
  initialBoard,
  initialTasks,
}: {
  orgId: string;
  initialBoard: NonNullable<BoardType>;
  initialTasks: Task[];
}) {
  const utils = trpc.useUtils();
  const [draggingTask, setDraggingTask] = React.useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 4 } })
  );

  // Queries
  const boardQ = trpc.boards.getDefault.useQuery({ orgId }, { initialData: initialBoard });
  const tasksQ = trpc.tasks.list.useQuery(
    { orgId },
    { initialData: initialTasks, refetchOnWindowFocus: false }
  );
  const sprintsQ = trpc.sprints.list.useQuery({ orgId });

  const activeSprints = (sprintsQ.data ?? []).filter((s) => s.status === "ACTIVE");
  const activeSprintIds = new Set(activeSprints.map((s) => s.id));

  const columns = (boardQ.data?.columns ?? [])
    .slice()
    .sort((a, b) => a.position - b.position);

  const tasks = (tasksQ.data ?? []).filter(
    (t) => t.sprintId && activeSprintIds.has(t.sprintId)
  );
  const byCol = useTasksByColumn(tasks);

  const onTaskClick = (id: string) => {
    window.open(`/dashboard/tasks/${id}`, "_blank");
  };

  // Inline add
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const create = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ orgId });
    },
  });
  const handleCreate = (columnId: string) => {
    const title = (drafts[columnId] ?? "").trim();
    if (!title) return;
    create.mutate({
      orgId,
      title,
      columnId: columnId === "none" ? null : columnId,
      type: "FEATURE",
      priority: "MEDIUM",
    });
    setDrafts((d) => ({ ...d, [columnId]: "" }));
  };

  // Move
  const move = trpc.tasks.move.useMutation({
    onMutate: async (vars) => {
      await utils.tasks.list.cancel({ orgId });
      const prev = utils.tasks.list.getData({ orgId });
      if (!prev) return { prev };

      const next = (() => {
        const all = [...prev];
        const moving = all.find((t) => t.id === vars.taskId);
        if (!moving) return all;

        const toCol = vars.toColumnId ?? null;
        const targetList = all
          .filter((t) => (t.columnId ?? null) === toCol && t.id !== vars.taskId)
          .sort(
            (a, b) =>
              a.position - b.position ||
              +new Date(a.createdAt) - +new Date(b.createdAt)
          );

        const targetIds = targetList.map((t) => t.id);
        targetIds.splice(Math.min(vars.toIndex, targetIds.length), 0, moving.id);

        return all.map((t) => {
          if (targetIds.includes(t.id)) {
            return {
              ...t,
              columnId: toCol,
              position: targetIds.indexOf(t.id),
            };
          }
          if (t.id === moving.id) {
            return { ...t, columnId: toCol, position: vars.toIndex };
          }
          return t;
        });
      })();

      utils.tasks.list.setData({ orgId }, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) utils.tasks.list.setData({ orgId }, ctx.prev);
    },
  });

  function onDragStart(e: DragStartEvent) {
    const id = e.active.id as string;
    const t = tasks.find((x) => x.id === id);
    setDraggingTask(t ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setDraggingTask(null);
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);

    let toColumnId: string | null = null;
    let toIndex = 0;

    if (overId.startsWith("col:")) {
      const cid = overId.slice("col:".length);
      toColumnId = cid === "none" ? null : cid;
      const list = byCol.get(toColumnId ?? "none") ?? [];
      toIndex = list.length;
    } else {
      const targetTask = tasks.find((t) => t.id === overId);
      if (!targetTask) return;
      toColumnId = targetTask.columnId ?? null;
      const list = byCol.get(toColumnId ?? "none") ?? [];
      const idx = list.findIndex((t) => t.id === targetTask.id);
      toIndex = idx === -1 ? list.length : idx;
    }

    move.mutate({ taskId, toColumnId, toIndex });
  }

  if (!boardQ.data || !tasksQ.data || !sprintsQ.data) {
    return <BoardSkeleton />;
  }

  return (
    <div className="w-full overflow-x-auto">
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-4 min-w-max">
          {columns.map((col) => {
            const colKey = col.id ?? "none";
            const list = byCol.get(colKey) ?? [];
            const count = list.length;
            const overWip = col.wipLimit ? count > col.wipLimit : false;

            return (
              <Card key={colKey} className="w-[320px] p-3 flex-shrink-0 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-medium">{col.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {col.wipLimit ? (
                      <span className={cn(overWip && "text-destructive font-medium")}>
                        {count}/{col.wipLimit}
                      </span>
                    ) : (
                      <span>{count}</span>
                    )}
                  </div>
                </div>

                <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <ColumnDroppable columnId={colKey}>
                    <div className="space-y-2">
                      {list.map((t) => (
                        <SortableTask key={t.id} task={t} onClick={onTaskClick} />
                      ))}
                    </div>
                  </ColumnDroppable>
                </SortableContext>

                {/* Inline add */}
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="New task title…"
                    value={drafts[colKey] ?? ""}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [colKey]: e.currentTarget.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleCreate(colKey)}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleCreate(colKey)}
                    disabled={!((drafts[colKey] ?? "").trim())}
                  >
                    Add
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* ghost preview */}
        <DragOverlay dropAnimation={null}>
          {draggingTask ? (
            <motion.div initial={{ rotate: 0 }} animate={{ rotate: 0.4 }} className="origin-center">
              <TaskCardLite task={draggingTask} disabled />
            </motion.div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
