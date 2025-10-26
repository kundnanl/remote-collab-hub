"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { trpc } from "@/server/client";
import type { RouterOutputs } from "@/server/client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  DndContext,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  Play,
  CheckCheck,
  Plus,
  Search,
  UsersRound,
  ListFilter,
  SquareGanttChart,
  EllipsisVertical,
  Loader2,
} from "lucide-react";

import { format } from "date-fns";

import { TaskRow } from "./TaskRow";
import TaskDrawer from "./TaskDrawer";
import { NewTaskDialog } from "./NewTaskDialog";
import { SprintDialog } from "@/components/tasks/SprintDialog";

type Task = RouterOutputs["tasks"]["list"][number];
type Sprint = RouterOutputs["sprints"]["list"][number];
type Column = RouterOutputs["tasks"]["orgMeta"]["columns"][number];
type Assignee = RouterOutputs["tasks"]["orgMeta"]["assignees"][number];

const BACKLOG_ID = "backlog";
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const TYPES = ["FEATURE", "BUG", "CHORE", "DOCS"] as const;

/* ----------------------------- Helpers ----------------------------- */

function DroppableList({
  id,
  children,
  disabled = false,
}: {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <motion.div
      ref={setNodeRef}
      className="relative rounded-md"
      animate={{
        outlineColor: isOver ? "rgba(34,197,94,.55)" : "transparent",
        outlineWidth: isOver ? 2 : 0,
      }}
      transition={{ duration: 0.18 }}
      style={{ outlineStyle: "solid" }}
    >
      <AnimatePresence>
        {isOver && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-md bg-emerald-400/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
      {children}
    </motion.div>
  );
}

function SectionHeader({
  title,
  right,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  const Ico = Icon ?? SquareGanttChart;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Ico className="h-4 w-4 text-muted-foreground" />
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && (
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

function countDone(tasks: Task[], columns: Column[]) {
  // Heuristic: any column titled "done" (case-insensitive) is done
  const doneCols = new Set(
    columns
      .filter((c) => c.title.toLowerCase() === "done")
      .map((c) => c.id),
  );
  if (doneCols.size === 0) return 0;
  return tasks.filter((t) => t.columnId && doneCols.has(t.columnId)).length;
}

/* ---------------------------- Filter Bar ---------------------------- */

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
  column,
  setColumn,
  columns,
}: {
  q: string;
  setQ: (v: string) => void;
  assignees: Assignee[];
  assignee: string | "any" | "unassigned";
  setAssignee: (v: string | "any" | "unassigned") => void;
  priority: (typeof PRIORITIES)[number] | "any";
  setPriority: (v: (typeof PRIORITIES)[number] | "any") => void;
  type: (typeof TYPES)[number] | "any";
  setType: (v: (typeof TYPES)[number] | "any") => void;
  column: string | "any" | "none";
  setColumn: (v: string | "any" | "none") => void;
  columns: Column[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="Search tasks by title…"
          className="pl-8 w-72"
        />
      </div>

      {/* Assignee */}
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
          <DropdownMenuItem onClick={() => setAssignee("unassigned")}>Unassigned</DropdownMenuItem>
          {assignees.map((a) => (
            <DropdownMenuItem key={a.clerkId} onClick={() => setAssignee(a.clerkId)}>
              {a.name ?? a.email}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Priority */}
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

      {/* Type */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <ListFilter className="h-4 w-4" />
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

      {/* State / Column */}
      {/* State / Column */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <ChevronsUpDown className="h-4 w-4" />
            {column === "any"
              ? "State"
              : column === "none"
                ? "—"
                : columns.find((c) => c.id === column)?.title ?? "State"}
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[10rem]">
          <DropdownMenuItem onClick={() => setColumn("any")}>Any</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setColumn("none")}>—</DropdownMenuItem>
          {columns.map((c) => (
            <DropdownMenuItem key={c.id} onClick={() => setColumn(c.id)}>
              {c.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* --------------------------- Sprint Row Header --------------------------- */

function SprintHeader({
  sprint,
  tasks,
  columns,
  onEdit,
  onStart,
  onComplete,
  collapsed,
  setCollapsed,
  starting,
  completing,
}: {
  sprint: Sprint;
  tasks: Task[];
  columns: Column[];
  onEdit: () => void;
  onStart: () => void;
  onComplete: () => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  starting?: boolean;
  completing?: boolean;
}) {
  const total = tasks.length;
  const done = countDone(tasks, columns);
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex items-center justify-between">
      {/* Left side: sprint info */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="group flex items-center gap-2 cursor-pointer select-none"
        aria-expanded={!collapsed}
        title={collapsed ? "Expand sprint" : "Collapse sprint"}
      >
        <span className="text-lg font-semibold">{sprint.name}</span>
        <span className="text-xs text-muted-foreground">
          {sprint.startDate ? format(new Date(sprint.startDate), "MMM d") : "—"}{" "}
          <span className="mx-1">→</span>{" "}
          {sprint.endDate ? format(new Date(sprint.endDate), "MMM d") : "—"}
        </span>
        <Badge
          variant={
            sprint.status === "ACTIVE"
              ? "default"
              : sprint.status === "CLOSED"
                ? "secondary"
                : "outline"
          }
          className="ml-2 capitalize"
        >
          {sprint.status.toLowerCase()}
        </Badge>

        {total > 0 && (
          <span className="ml-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block h-1.5 w-24 overflow-hidden rounded bg-muted">
              <span
                className="block h-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </span>
            {done}/{total}
          </span>
        )}
      </button>

      {/* Right side: actions */}
      <div className="flex items-center gap-2">
        {sprint.status === "PLANNED" && (
          <Button
            size="sm"
            className="gap-1"
            onClick={onStart}
            disabled={starting}
          >
            {starting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Starting…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Start
              </>
            )}
          </Button>
        )}

        {sprint.status === "ACTIVE" && (
          <Button
            size="sm"
            variant="secondary"
            className="gap-1"
            onClick={onComplete}
            disabled={completing}
          >
            {completing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Completing…
              </>
            ) : (
              <>
                <CheckCheck className="h-4 w-4" /> Complete
              </>
            )}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="More options"
            >
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Edit sprint</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/* ================================ Backlog ================================ */

export default function Backlog({
  orgId,
  initialSprints,
  initialTasks,
}: {
  orgId: string;
  initialSprints: Sprint[];
  initialTasks: Task[];
}) {
  const utils = trpc.useUtils();

  // queries
  const sprintsQ = trpc.sprints.list.useQuery({ orgId }, { initialData: initialSprints });
  const tasksQ = trpc.tasks.list.useQuery(
    { orgId },
    { initialData: initialTasks, refetchOnWindowFocus: false },
  );
  const metaQ = trpc.tasks.orgMeta.useQuery({ orgId });

  // mutations
  const moveToSprint = trpc.tasks.moveToSprint.useMutation({
    onMutate: async (vars) => {
      await utils.tasks.list.cancel({ orgId });
      const prev = utils.tasks.list.getData({ orgId });
      utils.tasks.list.setData({ orgId }, (old) => {
        if (!old) return old;
        const moving = old.find((t) => t.id === vars.taskId);
        if (!moving) return old;
        const others = old.filter((t) => t.id !== vars.taskId);

        const target = others
          .filter((t) => (t.sprintId ?? null) === (vars.toSprintId ?? null))
          .sort((a, b) => a.position - b.position || +new Date(a.createdAt) - +new Date(b.createdAt));

        target.splice(Math.min(vars.toIndex, target.length), 0, { ...moving, sprintId: vars.toSprintId });

        const reindexed = target.map((t, i) => ({ ...t, position: i }));
        return [
          ...others.filter((t) => (t.sprintId ?? null) !== (vars.toSprintId ?? null)),
          ...reindexed,
        ];
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) utils.tasks.list.setData({ orgId }, ctx.prev);
    },
    onSettled: () => utils.tasks.list.invalidate({ orgId }),
  });

  const startSprint = trpc.sprints.start.useMutation({
    onSuccess: () => utils.sprints.list.invalidate({ orgId }),
  });
  const completeSprint = trpc.sprints.complete.useMutation({
    onSuccess: () => utils.sprints.list.invalidate({ orgId }),
  });

  const bulkUpdate = trpc.tasks.bulkUpdate.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ orgId });
      setSelectedTasks(new Set());
    },
  });

  /* ------------------------------ Grouping ------------------------------ */

  const columns = metaQ.data?.columns ?? [];
  const assignees = metaQ.data?.assignees ?? [];

  const tasksBySprint = useMemo(() => {
    const map = new Map<string, Task[]>();
    (sprintsQ.data ?? []).forEach((s) => map.set(s.id, []));
    map.set(BACKLOG_ID, []);
    (tasksQ.data ?? []).forEach((t) => map.get(t.sprintId ?? BACKLOG_ID)!.push(t));
    for (const [, arr] of map) {
      arr.sort((a, b) => a.position - b.position || +new Date(a.createdAt) - +new Date(b.createdAt));
    }
    return map;
  }, [sprintsQ.data, tasksQ.data]);

  const active = (sprintsQ.data ?? []).filter((s) => s.status === "ACTIVE");
  const planned = (sprintsQ.data ?? []).filter((s) => s.status === "PLANNED");
  const closed = (sprintsQ.data ?? []).filter((s) => s.status === "CLOSED");

  /* ------------------------------- Filters ------------------------------ */

  const [q, setQ] = useState("");
  const [assignee, setAssignee] = useState<string | "any" | "unassigned">("any");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number] | "any">("any");
  const [type, setType] = useState<(typeof TYPES)[number] | "any">("any");
  const [columnFilter, setColumnFilter] = useState<string | "any" | "none">("any");

  const filterTask = React.useCallback(
    (t: Task) => {
      const needle = q.trim().toLowerCase();
      if (needle && !t.title.toLowerCase().includes(needle)) return false;
      if (assignee !== "any") {
        if (assignee === "unassigned" ? t.assigneeId !== null : t.assigneeId !== assignee)
          return false;
      }
      if (priority !== "any" && t.priority !== priority) return false;
      if (type !== "any" && t.type !== type) return false;
      if (columnFilter !== "any") {
        if (columnFilter === "none" ? t.columnId !== null : t.columnId !== columnFilter)
          return false;
      }
      return true;
    },
    [q, assignee, priority, type, columnFilter],
  );

  /* ---------------------------- Selection / Bulk ---------------------------- */

  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const anySelected = selectedTasks.size > 0;
  const toggleTaskSel = (id: string, on: boolean) =>
    setSelectedTasks((prev) => {
      const n = new Set(prev);
      if (on) {
        n.add(id);
      } else {
        n.delete(id);
      }
      return n;
    });

  /* --------------------------------- DnD --------------------------------- */

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 4 } }),
  );

  const [dragging, setDragging] = useState<Task | null>(null);
  const [lastChangedId, setLastChangedId] = useState<string | null>(null);

  function onDragStart(e: DragStartEvent) {
    const t = tasksQ.data?.find((x) => x.id === (e.active.id as string));
    setDragging(t ?? null);
  }
  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    if (!e.over) return;
    const taskId = String(e.active.id);
    const overId = String(e.over.id);

    let toSprintId: string | null;
    let toIndex = 0;

    if (overId.startsWith("sprint:")) {
      const raw = overId.slice("sprint:".length);
      toSprintId = raw === BACKLOG_ID ? null : raw;
      toIndex = (tasksBySprint.get(toSprintId ?? BACKLOG_ID) ?? []).filter(filterTask).length;
    } else {
      const targetTask = tasksQ.data?.find((t) => t.id === overId);
      if (!targetTask) return;
      toSprintId = targetTask.sprintId ?? null;
      const list = (tasksBySprint.get(toSprintId ?? BACKLOG_ID) ?? []).filter(filterTask);
      const idx = list.findIndex((t) => t.id === targetTask.id);
      toIndex = idx === -1 ? list.length : idx;
    }

    moveToSprint.mutate({ taskId, toSprintId, toIndex });
    setLastChangedId(taskId);
    setTimeout(() => setLastChangedId(null), 700);
  }

  /* ------------------------------- UI State ------------------------------- */

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const openTask = (id: string) => {
    setSelectedTaskId(id);
    setDrawerOpen(true);
  };

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editSprintId, setEditSprintId] = useState<string | null>(null);

  // Collapsed state per sprint id
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  /* -------------------------------- Render -------------------------------- */

  if (!metaQ.data) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Backlog" subtitle="Plan upcoming work and sprints." icon={SquareGanttChart} />
        <Card className="p-6 animate-pulse" />
      </div>
    );
  }

  const backlogItems = (tasksBySprint.get(BACKLOG_ID) ?? []).filter(filterTask);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <SectionHeader
        title="Backlog"
        subtitle="Create sprints, prioritize work, and prepare for execution."
        icon={SquareGanttChart}
        right={
          <div className="flex items-center gap-2">
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New sprint
            </Button>
            <SprintDialog
              orgId={orgId}
              mode="create"
              open={createDialogOpen}
              setOpen={setCreateDialogOpen}
            />
            <NewTaskDialog orgId={orgId} defaultSprintId={null} />
          </div>
        }
      />

      {/* Filters */}
      <div className="relative">
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
          column={columnFilter}
          setColumn={setColumnFilter}
          columns={columns}
        />
      </div>

      {/* Sticky bulk action bar */}
      <AnimatePresence>
        {anySelected && (
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            className="sticky top-0 z-30 flex items-center gap-2 rounded-md border bg-background/95 p-2 backdrop-blur"
          >
            <span className="text-sm">{selectedTasks.size} selected</span>

            {/* Priority */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">Priority</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {PRIORITIES.map((p) => (
                  <DropdownMenuItem
                    key={p}
                    onClick={() =>
                      bulkUpdate.mutate({
                        orgId,
                        taskIds: [...selectedTasks],
                        data: { priority: p },
                      })
                    }
                  >
                    {p.toLowerCase()}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* State */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">State</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[12rem]">
                <DropdownMenuItem
                  onClick={() =>
                    bulkUpdate.mutate({
                      orgId,
                      taskIds: [...selectedTasks],
                      data: { columnId: null },
                    })
                  }
                >
                  Backlog
                </DropdownMenuItem>
                {columns.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() =>
                      bulkUpdate.mutate({
                        orgId,
                        taskIds: [...selectedTasks],
                        data: { columnId: c.id },
                      })
                    }
                  >
                    {c.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Assignee */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">Assignee</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[280px] overflow-auto">
                <DropdownMenuItem
                  onClick={() =>
                    bulkUpdate.mutate({
                      orgId,
                      taskIds: [...selectedTasks],
                      data: { assigneeId: null },
                    })
                  }
                >
                  Unassigned
                </DropdownMenuItem>
                {assignees.map((u) => (
                  <DropdownMenuItem
                    key={u.clerkId}
                    onClick={() =>
                      bulkUpdate.mutate({
                        orgId,
                        taskIds: [...selectedTasks],
                        data: { assigneeId: u.clerkId },
                      })
                    }
                  >
                    {u.name ?? u.email}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Move to sprint */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">Move to sprint</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() =>
                    bulkUpdate.mutate({
                      orgId,
                      taskIds: [...selectedTasks],
                      data: { sprintId: null },
                    })
                  }
                >
                  Backlog
                </DropdownMenuItem>
                {(sprintsQ.data ?? []).map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() =>
                      bulkUpdate.mutate({
                        orgId,
                        taskIds: [...selectedTasks],
                        data: { sprintId: s.id },
                      })
                    }
                  >
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" variant="ghost" onClick={() => setSelectedTasks(new Set())}>
              Clear
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {/* Active */}
        {active.length > 0 && (
          <>
            <SectionHeader
              title="Active sprint"
              subtitle="Work currently in progress."
              icon={CalendarIcon}
            />
            <div className="space-y-4">
              {active.map((s) => {
                const list = (tasksBySprint.get(s.id) ?? []).filter(filterTask);
                const isCollapsed = !!collapsed[s.id];
                return (
                  <Card key={s.id} className="rounded-xl p-5">
                    <SprintHeader
                      sprint={s}
                      tasks={tasksBySprint.get(s.id) ?? []}
                      columns={columns}
                      onEdit={() => setEditSprintId(s.id)}
                      onStart={() => startSprint.mutate({ sprintId: s.id, orgId })}
                      onComplete={() => completeSprint.mutate({ sprintId: s.id, orgId })}
                      collapsed={isCollapsed}
                      setCollapsed={(v) => setCollapsed((c) => ({ ...c, [s.id]: v }))}
                      starting={startSprint.isPending && startSprint.variables?.sprintId === s.id}
                      completing={completeSprint.isPending && completeSprint.variables?.sprintId === s.id}
                    />

                    {!isCollapsed && (
                      <div className="mt-3">
                        <DroppableList id={`sprint:${s.id}`}>
                          <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                            <div className="divide-y rounded-md border bg-card">
                              {list.map((t) => (
                                <TaskRow
                                  key={t.id}
                                  task={t}
                                  columns={columns}
                                  assignees={assignees}
                                  selected={selectedTasks.has(t.id)}
                                  onToggleSelect={(on) => toggleTaskSel(t.id, on)}
                                  onOpen={openTask}
                                  recentlyChanged={t.id === lastChangedId}
                                />
                              ))}
                              {list.length === 0 && (
                                <div className="py-8 text-center text-sm text-muted-foreground">
                                  No tasks match your filters.
                                </div>
                              )}
                            </div>
                          </SortableContext>
                        </DroppableList>
                        <div className="mt-4">
                          <NewTaskDialog orgId={orgId} defaultSprintId={s.id} small />
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
            <Separator />
          </>
        )}

        {/* Planned */}
        <SectionHeader title="Upcoming sprints" subtitle="Plan and prioritize future work." icon={CalendarIcon} />
        <div className="space-y-4">
          {planned.map((s) => {
            const list = (tasksBySprint.get(s.id) ?? []).filter(filterTask);
            const isCollapsed = !!collapsed[s.id];
            return (
              <Card key={s.id} className="rounded-xl p-5">
                <SprintHeader
                  sprint={s}
                  tasks={tasksBySprint.get(s.id) ?? []}
                  columns={columns}
                  onEdit={() => setEditSprintId(s.id)}
                  onStart={() => startSprint.mutate({ sprintId: s.id, orgId })}
                  onComplete={() => completeSprint.mutate({ sprintId: s.id, orgId })}
                  collapsed={isCollapsed}
                  setCollapsed={(v) => setCollapsed((c) => ({ ...c, [s.id]: v }))}
                  starting={startSprint.isPending && startSprint.variables?.sprintId === s.id}
                  completing={completeSprint.isPending && completeSprint.variables?.sprintId === s.id}
                />

                {!isCollapsed && (
                  <>
                    <div className="mt-3">
                      <DroppableList id={`sprint:${s.id}`}>
                        <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                          <div className="divide-y rounded-md border bg-card">
                            {list.map((t) => (
                              <TaskRow
                                key={t.id}
                                task={t}
                                columns={columns}
                                assignees={assignees}
                                selected={selectedTasks.has(t.id)}
                                onToggleSelect={(on) => toggleTaskSel(t.id, on)}
                                onOpen={openTask}
                                recentlyChanged={t.id === lastChangedId}
                              />
                            ))}
                            {list.length === 0 && (
                              <div className="py-8 text-center text-sm text-muted-foreground">
                                No tasks match your filters.
                              </div>
                            )}
                          </div>
                        </SortableContext>
                      </DroppableList>
                    </div>
                    <div className="mt-4">
                      <NewTaskDialog orgId={orgId} defaultSprintId={s.id} small />
                    </div>
                  </>
                )}
              </Card>
            );
          })}
          {planned.length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground">
              No planned sprints. Create one to start organizing upcoming work.
            </Card>
          )}
        </div>

        {/* Backlog bucket */}
        <SectionHeader
          title="Backlog"
          subtitle="Unscheduled items. Drag into a sprint to plan."
          icon={ListFilter}
          right={<Badge variant="outline">{backlogItems.length}</Badge>}
        />
        <Card className="rounded-xl p-4">
          <DroppableList id={`sprint:${BACKLOG_ID}`}>
            <SortableContext items={backlogItems.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y rounded-md border bg-card">
                {backlogItems.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    columns={columns}
                    assignees={assignees}
                    selected={selectedTasks.has(t.id)}
                    onToggleSelect={(on) => toggleTaskSel(t.id, on)}
                    onOpen={openTask}
                    recentlyChanged={t.id === lastChangedId}
                  />
                ))}
                {backlogItems.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No tasks match your filters.
                  </div>
                )}
              </div>
            </SortableContext>
          </DroppableList>
          <div className="mt-3">
            <NewTaskDialog orgId={orgId} defaultSprintId={null} small />
          </div>
        </Card>

        {/* Closed sprints (collapsed) */}
        {closed.length > 0 && (
          <>
            <Separator />
            <SectionHeader title="Closed sprints" subtitle="Read-only history." icon={CalendarIcon} />
            <div className="space-y-3">
              {closed.map((s) => {
                const list = (tasksBySprint.get(s.id) ?? []).filter(filterTask);
                return (
                  <Card key={s.id} className="rounded-xl p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.name}</span>
                        <Badge variant="secondary" className="capitalize">
                          {s.status.toLowerCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-2">
                          {s.startDate ? format(new Date(s.startDate), "MMM d") : "—"} →{" "}
                          {s.endDate ? format(new Date(s.endDate), "MMM d") : "—"}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" disabled>
                        View report
                      </Button>
                    </div>
                    <div className="mt-3 rounded-md border bg-card">
                      {list.length ? (
                        list.map((t) => (
                          <TaskRow
                            key={t.id}
                            task={t}
                            columns={columns}
                            assignees={assignees}
                            selected={selectedTasks.has(t.id)}
                            onToggleSelect={(on) => toggleTaskSel(t.id, on)}
                            onOpen={openTask}
                            recentlyChanged={false}
                          />
                        ))
                      ) : (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          No tasks.
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {/* Drag ghost */}
        <DragOverlay dropAnimation={null}>
          {dragging ? (
            <div className="rounded-md border bg-card px-2 py-2">{dragging.title}</div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {editSprintId && (
        <SprintDialog
          orgId={orgId}
          mode="edit"
          sprintId={editSprintId}
          open={!!editSprintId}
          setOpen={(v) => !v && setEditSprintId(null)}
        />
      )}

      {/* Task drawer */}
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
