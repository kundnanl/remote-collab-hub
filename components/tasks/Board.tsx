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
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  Filter,
  Plus,
  UsersRound,
  Search,
  SortAsc,
  EllipsisVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import TaskDrawer from "@/components/tasks/TaskDrawer";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSimpleToast } from "@/components/ui/simple-toast";

type BoardType = RouterOutputs["boards"]["getDefault"];
type Task = RouterOutputs["tasks"]["list"][number];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const TYPES = ["FEATURE", "BUG", "CHORE", "DOCS"] as const;

/* ---------------------------- Skeleton (Board) ---------------------------- */

export function BoardSkeleton() {
  return (
    <div className="w-full">
      <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-xl shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="mt-3 space-y-2">
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
              +new Date(a.createdAt) - +new Date(b.createdAt),
          ),
      );
    }
    return map;
  }, [tasks]);
}

function pill(cls = "") {
  return cn(
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
    cls,
  );
}

/* ----------------------------- Task Card (Pro) ---------------------------- */

function TaskCard({
  task,
  onClick,
  dragHandleProps,
  disabled,
  assignees,
}: {
  task: Task;
  onClick?: (id: string) => void;
  dragHandleProps?: Record<string, unknown>;
  disabled?: boolean;
  assignees: RouterOutputs["tasks"]["orgMeta"]["assignees"];
}) {
  const assignee = assignees.find((a) => a.clerkId === task.assigneeId) ?? null;

  return (
    <button
      onClick={() => onClick?.(task.id)}
      className={cn(
        "w-full text-left rounded-lg border bg-card p-3 shadow-sm transition-all",
        "hover:bg-muted/40 hover:shadow",
        "cursor-grab active:cursor-grabbing",
        disabled && "opacity-60",
      )}
      {...dragHandleProps}
      aria-label={`Open task ${task.title}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-medium">{task.title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={pill(
                "bg-secondary text-secondary-foreground capitalize",
              )}
            >
              {task.type.toLowerCase()}
            </span>
            <span className={pill("bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 capitalize")}>
              {task.priority.toLowerCase()}
            </span>
            {task.estimate != null && (
              <span className={pill("bg-muted text-muted-foreground")}>
                {task.estimate} pts
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {assignee ? (
            <div
              className="flex size-7 items-center justify-center rounded-full border bg-muted text-xs"
              title={assignee.name ?? assignee.email}
            >
              {(assignee.name ?? assignee.email ?? "U").charAt(0).toUpperCase()}
            </div>
          ) : (
            <div
              className="flex size-7 items-center justify-center rounded-full border bg-muted text-[10px] text-muted-foreground"
              title="Unassigned"
            >
              —
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function SortableTask({
  task,
  onClick,
  assignees,
}: {
  task: Task;
  onClick: (id: string) => void;
  assignees: RouterOutputs["tasks"]["orgMeta"]["assignees"];
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
      <TaskCard
        task={task}
        onClick={onClick}
        dragHandleProps={{ ...attributes, ...listeners }}
        disabled={isDragging}
        assignees={assignees}
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
      className="relative space-y-2"
      animate={{
        outlineColor: isOver ? "rgba(34,197,94,0.6)" : "transparent",
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
            className="pointer-events-none absolute inset-0 rounded-lg bg-emerald-400"
          />
        )}
      </AnimatePresence>
      {children}
    </motion.div>
  );
}

/* ------------------------------- Toolbar -------------------------------- */

function FilterBar({
  q,
  setQ,
  assignees,
  assignee,
  setAssignee,
  priority,
  setPriority,
  type,
  setType,
}: {
  q: string;
  setQ: (v: string) => void;
  assignees: RouterOutputs["tasks"]["orgMeta"]["assignees"];
  assignee: string | "any" | "unassigned";
  setAssignee: (v: string | "any" | "unassigned") => void;
  priority: (typeof PRIORITIES)[number] | "any";
  setPriority: (v: (typeof PRIORITIES)[number] | "any") => void;
  type: (typeof TYPES)[number] | "any";
  setType: (v: (typeof TYPES)[number] | "any") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="Search tasks…"
          className="pl-8 w-64"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <UsersRound className="h-4 w-4" />
            {assignee === "any"
              ? "Assignee"
              : assignee === "unassigned"
                ? "Unassigned"
                : assignees.find((a) => a.clerkId === assignee)?.name ?? "Assignee"}
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[280px] overflow-auto">
          <DropdownMenuItem onClick={() => setAssignee("any")}>Any</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAssignee("unassigned")}>
            Unassigned
          </DropdownMenuItem>
          {assignees.map((a) => (
            <DropdownMenuItem key={a.clerkId} onClick={() => setAssignee(a.clerkId)}>
              {a.name ?? a.email}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            {priority === "any" ? "Priority" : priority.toLowerCase()}
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => setPriority("any")}>Any</DropdownMenuItem>
          {PRIORITIES.map((p) => (
            <DropdownMenuItem key={p} onClick={() => setPriority(p)}>
              {p.toLowerCase()}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <SortAsc className="h-4 w-4" />
            {type === "any" ? "Type" : type.toLowerCase()}
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => setType("any")}>Any</DropdownMenuItem>
          {TYPES.map((t) => (
            <DropdownMenuItem key={t} onClick={() => setType(t)}>
              {t.toLowerCase()}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
  const toast = useSimpleToast();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 4 } }),
  );

  // Queries
  const boardQ = trpc.boards.getDefault.useQuery({ orgId }, { initialData: initialBoard });
  const tasksQ = trpc.tasks.list.useQuery(
    { orgId },
    { initialData: initialTasks, refetchOnWindowFocus: false },
  );
  const sprintsQ = trpc.sprints.list.useQuery({ orgId });
  const metaQ = trpc.tasks.orgMeta.useQuery({ orgId });

  const activeSprints = (sprintsQ.data ?? []).filter((s) => s.status === "ACTIVE");
  const activeSprintIds = new Set(activeSprints.map((s) => s.id));

  const columns = (boardQ.data?.columns ?? [])
    .slice()
    .sort((a, b) => a.position - b.position);

  // Base task set = only active sprint tasks
  const baseTasks = (tasksQ.data ?? []).filter(
    (t) => t.sprintId && activeSprintIds.has(t.sprintId),
  );

  /* ------------------------------ Filters ------------------------------ */
  const [q, setQ] = React.useState("");
  const [assignee, setAssignee] = React.useState<string | "any" | "unassigned">("any");
  const [priority, setPriority] = React.useState<(typeof PRIORITIES)[number] | "any">("any");
  const [type, setType] = React.useState<(typeof TYPES)[number] | "any">("any");
  const [pendingTask, setPendingTask] = React.useState<{ title: string; columnId: string } | null>(null);
  const [sprintPickerOpen, setSprintPickerOpen] = React.useState(false);


  const tasks = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return baseTasks.filter((t) => {
      if (needle && !t.title.toLowerCase().includes(needle)) return false;
      if (assignee !== "any") {
        if (assignee === "unassigned" ? t.assigneeId !== null : t.assigneeId !== assignee)
          return false;
      }
      if (priority !== "any" && t.priority !== priority) return false;
      if (type !== "any" && t.type !== type) return false;
      return true;
    });
  }, [baseTasks, q, assignee, priority, type]);

  const byCol = useTasksByColumn(tasks);

  // Inline add
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const create = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ orgId });
      setDrafts({});
    },
  });
  const handleCreate = async (columnId: string) => {
    const title = (drafts[columnId] ?? "").trim();
    if (!title) return;

    // If no sprints, you can show a toast instead
    if (activeSprints.length === 0) {
      toast.push("No active sprint found. Please start a sprint first.");
      return;
    }

    // If one sprint — auto assign
    if (activeSprints.length === 1) {
      create.mutate({
        orgId,
        title,
        columnId: columnId === "none" ? null : columnId,
        sprintId: activeSprints[0].id,
        type: "FEATURE",
        priority: "MEDIUM",
      });
      return;
    }

    // If multiple active sprints — open modal
    setPendingTask({
      title,
      columnId,
    });
    setSprintPickerOpen(true);
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
              +new Date(a.createdAt) - +new Date(b.createdAt),
          );

        const targetIds = targetList.map((t) => t.id);
        targetIds.splice(Math.min(vars.toIndex, targetIds.length), 0, moving.id);

        return all.map((t) => {
          if (targetIds.includes(t.id)) {
            return { ...t, columnId: toCol, position: targetIds.indexOf(t.id) };
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
    onSettled: () => utils.tasks.list.invalidate({ orgId }),
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

  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const openTask = (id: string) => {
    setSelectedTaskId(id);
    setDrawerOpen(true);
  };

  if (!boardQ.data || !tasksQ.data || !sprintsQ.data || !metaQ.data) {
    return <BoardSkeleton />;
  }

  const assignees = metaQ.data.assignees;

  return (
    <div className="w-full space-y-4">
      {/* Toolbar / Filters */}
      <FilterBar
        q={q}
        setQ={setQ}
        assignees={assignees}
        assignee={assignee}
        setAssignee={setAssignee}
        priority={priority}
        setPriority={setPriority}
        type={type}
        setType={setType}
      />

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {/* Responsive, wrapped grid — no horizontal scrolling */}
        <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]">
          {columns.map((col) => {
            const colKey = col.id ?? "none";
            const list = byCol.get(colKey) ?? [];
            const count = list.length;
            const overWip = col.wipLimit ? count > col.wipLimit : false;

            return (
              <Card key={colKey} className="rounded-xl border shadow-sm">
                {/* Sticky-ish header for each column */}
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-card/95 px-4 py-3 backdrop-blur">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate font-medium">{col.title}</div>
                    <Badge
                      variant={overWip ? "destructive" : "secondary"}
                      className="rounded-full"
                    >
                      {count}
                      {col.wipLimit ? ` / ${col.wipLimit}` : ""}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <EllipsisVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled>Edit column</DropdownMenuItem>
                      <DropdownMenuItem disabled>Set WIP limit</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Task list */}
                <div className="px-4 py-3">
                  <SortableContext
                    items={list.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ColumnDroppable columnId={colKey}>
                      <div className={cn("space-y-2", list.length === 0 && "pb-2")}>
                        {list.length === 0 && (
                          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                            No tasks
                          </div>
                        )}
                        {list.map((t) => (
                          <SortableTask
                            key={t.id}
                            task={t}
                            onClick={openTask}
                            assignees={assignees}
                          />
                        ))}
                      </div>
                    </ColumnDroppable>
                  </SortableContext>

                  {/* Inline add */}
                  <div className="mt-3 flex gap-2">
                    <Input
                      placeholder="New task title…"
                      value={drafts[colKey] ?? ""}
                      onChange={(e) => {
                        const v = e.currentTarget.value;
                        setDrafts((d) => ({ ...d, [colKey]: v }));
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleCreate(colKey)}
                    />
                    <Button
                      size="sm"
                      onClick={() => handleCreate(colKey)}
                      disabled={!((drafts[colKey] ?? "").trim()) || create.isPending}
                      className="gap-1"
                    >
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* ghost preview */}
        <DragOverlay dropAnimation={null}>
          {draggingTask ? (
            <motion.div initial={{ rotate: 0 }} animate={{ rotate: 0.4 }} className="origin-center">
              <TaskCard task={draggingTask} disabled assignees={assignees} />
            </motion.div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {pendingTask && (
        <Dialog open={sprintPickerOpen} onOpenChange={setSprintPickerOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Select Sprint</DialogTitle>
              <DialogDescription>
                Choose which sprint this task should be added to.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 mt-3">
              {activeSprints.map((s) => (
                <Button
                  key={s.id}
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => {
                    create.mutate({
                      orgId,
                      title: pendingTask.title,
                      columnId: pendingTask.columnId === "none" ? null : pendingTask.columnId,
                      sprintId: s.id,
                      type: "FEATURE",
                      priority: "MEDIUM",
                    });
                    setPendingTask(null);
                    setSprintPickerOpen(false);
                  }}
                >
                  {s.name}
                  <span className="text-xs text-muted-foreground">
                    {s.startDate ? new Date(s.startDate).toLocaleDateString() : "?"} →
                    {s.endDate ? new Date(s.endDate).toLocaleDateString() : "?"}
                  </span>
                </Button>
              ))}
            </div>

            <DialogFooter className="mt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setSprintPickerOpen(false);
                  setPendingTask(null);
                }}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}


      {/* Drawer for details (keeps alignment with the rest of the app) */}
      <TaskDrawer
        taskId={selectedTaskId}
        orgId={orgId}
        open={drawerOpen}
        onOpenChange={(v) => {
          setDrawerOpen(v);
          if (!v) setSelectedTaskId(null);
        }}
      />
    </div>
  );
}
