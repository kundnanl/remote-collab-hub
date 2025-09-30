"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { trpc } from "@/server/client";
import type { RouterOutputs } from "@/server/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import TaskDrawer from "@/components/tasks/TaskDrawer";
import { SprintCreateDialog } from "@/components/tasks/SprintCreateDialog";
import {
  DndContext, DragStartEvent, DragEndEvent, DragOverlay,
  useDroppable, MouseSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, defaultAnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CalendarIcon, Play, CheckCheck, Pencil } from "lucide-react";
import { format } from "date-fns";
import { TaskRow } from "./TaskRow";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Task = RouterOutputs["tasks"]["list"][number];
type Sprint = RouterOutputs["sprints"]["list"][number];
const BACKLOG_ID = "backlog";

function DroppableList({
  id, children, isSoftTint = true,
}: { id: string; children: React.ReactNode; isSoftTint?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <motion.div
      ref={setNodeRef}
      className="rounded-md"
      animate={{ outlineColor: isOver ? "rgba(34,197,94,.6)" : "transparent", outlineWidth: isOver ? 2 : 0 }}
      transition={{ duration: .18 }}
      style={{ outlineStyle: "solid" }}
    >
      <AnimatePresence>
        {isOver && isSoftTint && (
          <motion.div className="absolute inset-0 rounded-md bg-emerald-400/10 pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        )}
      </AnimatePresence>
      {children}
    </motion.div>
  );
}

/** --- sprint header row with checkbox + inline rename --- */
function SprintHeader({
  sprint, selected, onToggleSelect, onStart, onComplete, onRename,
}: {
  sprint: Sprint;
  selected: boolean;
  onToggleSelect: (checked: boolean) => void;
  onStart: () => void;
  onComplete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sprint.name);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <input type="checkbox" className="size-4" checked={selected} onChange={(e) => onToggleSelect(e.currentTarget.checked)} />
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { setEditing(false); if (name.trim() && name !== sprint.name) onRename(name.trim()); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setEditing(false); setName(sprint.name); } }}
            className="bg-transparent border rounded px-2 py-1 text-sm"
          />
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{sprint.name}</h2>
            <button className="p-1 rounded hover:bg-muted" onClick={() => setEditing(true)} aria-label="Rename sprint">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <span className="ml-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
          <CalendarIcon className="h-3.5 w-3.5" />
          {sprint.startDate ? format(new Date(sprint.startDate), "MMM d") : "—"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Badge className={cn(
          "px-2 py-0.5 rounded-full text-xs capitalize",
          sprint.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
        )}>
          {sprint.status.toLowerCase()}
        </Badge>
        {sprint.status === "PLANNED" ? (
          <Button size="sm" onClick={onStart} className="gap-1"><Play className="h-4 w-4" />Start</Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={onComplete} className="gap-1"><CheckCheck className="h-4 w-4" />Complete</Button>
        )}
      </div>
    </div>
  );
}

export default function Backlog({
  orgId, initialSprints, initialTasks,
}: { orgId: string; initialSprints: Sprint[]; initialTasks: Task[] }) {
  const utils = trpc.useUtils();

  // queries
  const sprintsQ = trpc.sprints.list.useQuery({ orgId }, { initialData: initialSprints });
  const tasksQ = trpc.tasks.list.useQuery({ orgId }, { initialData: initialTasks, refetchOnWindowFocus: false });
  const metaQ = trpc.tasks.orgMeta.useQuery({ orgId });

  // sensors → row-wide drag, click still works
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 4 } })
  );

  // grouping
  const tasksBySprint = useMemo(() => {
    const map = new Map<string, Task[]>();
    (sprintsQ.data ?? []).forEach(s => map.set(s.id, []));
    map.set(BACKLOG_ID, []);
    (tasksQ.data ?? []).forEach(t => map.get(t.sprintId ?? BACKLOG_ID)!.push(t));
    for (const [k, arr] of map) arr.sort((a, b) => a.position - b.position || +new Date(a.createdAt) - +new Date(b.createdAt));
    return map;
  }, [sprintsQ.data, tasksQ.data]);

  // selection (mass actions)
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [selectedSprints, setSelectedSprints] = useState<Set<string>>(new Set());
  const toggleTaskSel = (id: string, on: boolean) =>
    setSelectedTasks(prev => { const n = new Set(prev); on ? n.add(id) : n.delete(id); return n; });

  // mutations
  const moveToSprint = trpc.tasks.moveToSprint.useMutation({
    onMutate: async (vars) => {
      await utils.tasks.list.cancel({ orgId });
      const prev = utils.tasks.list.getData({ orgId });
      utils.tasks.list.setData({ orgId }, (old) => {
        if (!old) return old;
        const moving = old.find(t => t.id === vars.taskId);
        if (!moving) return old;
        const others = old.filter(t => t.id !== vars.taskId);
        const target = others.filter(t => (t.sprintId ?? null) === (vars.toSprintId ?? null))
          .sort((a, b) => a.position - b.position || +new Date(a.createdAt) - +new Date(b.createdAt));
        target.splice(Math.min(vars.toIndex, target.length), 0, { ...moving, sprintId: vars.toSprintId });
        return [...others.filter(t => (t.sprintId ?? null) !== (vars.toSprintId ?? null)), ...target.map((t, i) => ({ ...t, position: i }))];
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) utils.tasks.list.setData({ orgId }, ctx.prev); },
    onSettled: () => utils.tasks.list.invalidate({ orgId }),
  });

  const updateSprint = trpc.sprints.update.useMutation({
    onMutate: async (vars) => {
      await utils.sprints.list.cancel({ orgId });
      const prev = utils.sprints.list.getData({ orgId });
      utils.sprints.list.setData({ orgId }, (old) =>
        old ? old.map((s) => (s.id === vars.sprintId ? { ...s, name: vars.name ?? s.name } : s)) : old
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) utils.sprints.list.setData({ orgId }, ctx.prev); },
    onSettled: () => utils.sprints.list.invalidate({ orgId }),
  });

  const bulkUpdate = trpc.tasks.bulkUpdate.useMutation({
    onSuccess: () => { utils.tasks.list.invalidate({ orgId }); setSelectedTasks(new Set()); },
  });

  const setSprintSelected = (sprintId: string, on: boolean) => {
    const list = tasksBySprint.get(sprintId) ?? [];
    setSelectedTasks(prev => {
      const n = new Set(prev);
      for (const t of list) on ? n.add(t.id) : n.delete(t.id);
      return n;
    });
    setSelectedSprints(prev => {
      const n = new Set(prev);
      on ? n.add(sprintId) : n.delete(sprintId);
      return n;
    });
  };

  // DnD
  const [dragging, setDragging] = useState<Task | null>(null);
  const [lastChangedId, setLastChangedId] = useState<string | null>(null);

  function onDragStart(e: DragStartEvent) {
    const t = tasksQ.data?.find(x => x.id === (e.active.id as string));
    setDragging(t ?? null);
  }
  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    if (!e.over) return;
    const taskId = String(e.active.id);
    const overId = String(e.over.id);
    let toSprintId: string | null; let toIndex = 0;

    if (overId.startsWith("sprint:")) {
      const raw = overId.slice("sprint:".length);
      toSprintId = raw === BACKLOG_ID ? null : raw;
      toIndex = (tasksBySprint.get(toSprintId ?? BACKLOG_ID) ?? []).length;
    } else {
      const targetTask = tasksQ.data?.find((t) => t.id === overId); if (!targetTask) return;
      toSprintId = targetTask.sprintId ?? null;
      const list = tasksBySprint.get(toSprintId ?? BACKLOG_ID) ?? [];
      const idx = list.findIndex((t) => t.id === targetTask.id);
      toIndex = idx === -1 ? list.length : idx;
    }
    moveToSprint.mutate({ taskId, toSprintId, toIndex });
    setLastChangedId(taskId); // flash green on that row
    setTimeout(() => setLastChangedId(null), 700);
  }

  // UI state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openTask = (id: string) => { setSelectedTaskId(id); setDrawerOpen(true); };

  const active = (sprintsQ.data ?? []).filter(s => s.status === "ACTIVE");
  const planned = (sprintsQ.data ?? []).filter(s => s.status === "PLANNED");
  const backlogItems = tasksBySprint.get(BACKLOG_ID) ?? [];

  const anySelected = selectedTasks.size > 0;

  return (
    <div className="space-y-8">
      {/* sticky mass action bar */}
      <AnimatePresence>
        {anySelected && metaQ.data && (
          <motion.div
            initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}
            className="sticky top-0 z-30 border rounded-md p-2 bg-background/95 backdrop-blur flex items-center gap-2"
          >
            <span className="text-sm">{selectedTasks.size} selected</span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">Priority</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {["LOW", "MEDIUM", "HIGH", "URGENT"].map(p => (
                  <DropdownMenuItem key={p}
                    onClick={() => bulkUpdate.mutate({ orgId, taskIds: [...selectedTasks], data: { priority: p as any } })}
                  >{p.toLowerCase()}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">State</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[12rem]">
                <DropdownMenuItem onClick={() => bulkUpdate.mutate({ orgId, taskIds: [...selectedTasks], data: { columnId: null } })}>
                  Backlog
                </DropdownMenuItem>
                {metaQ.data.columns.map(c => (
                  <DropdownMenuItem key={c.id}
                    onClick={() => bulkUpdate.mutate({ orgId, taskIds: [...selectedTasks], data: { columnId: c.id } })}
                  >{c.title}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">Move to sprint</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => bulkUpdate.mutate({ orgId, taskIds: [...selectedTasks], data: { sprintId: null } })}>
                  Backlog
                </DropdownMenuItem>
                {(metaQ.data.sprints ?? []).map(s => (
                  <DropdownMenuItem key={s.id}
                    onClick={() => bulkUpdate.mutate({ orgId, taskIds: [...selectedTasks], data: { sprintId: s.id } })}
                  >{s.name}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" variant="ghost" onClick={() => setSelectedTasks(new Set())}>Clear</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Backlog</h1>
        </div>
        <div className="flex items-center gap-2">
          <SprintCreateDialog orgId={orgId} />
          <NewTaskDialog orgId={orgId} defaultSprintId={null} small />
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {/* Active */}
        {active.length > 0 && (
          <>
            <div className="text-sm font-semibold text-muted-foreground">Active sprint</div>
            <div className="space-y-4">
              {active.map((s) => {
                const list = tasksBySprint.get(s.id) ?? [];
                return (
                  <Card key={s.id} className="p-5 rounded-xl">
                    <SprintHeader
                      sprint={s}
                      selected={selectedSprints.has(s.id)}
                      onToggleSelect={(on) => setSprintSelected(s.id, on)}                  
                      onStart={() => {/* your existing start */ }}
                      onComplete={() => {/* your existing complete */ }}
                      onRename={(name) => updateSprint.mutate({ orgId, sprintId: s.id, name })} 
                    />

                    <div className="mt-3">
                      <DroppableList id={`sprint:${s.id}`}>
                        <SortableContext items={list.map(t => t.id)} strategy={verticalListSortingStrategy}>
                          <div className="divide-y rounded-md bg-card">
                            {list.map((t) => (
                              <TaskRow
                                key={t.id}
                                task={t}
                                columns={metaQ.data?.columns ?? []}
                                assignees={metaQ.data?.assignees ?? []}
                                selected={selectedTasks.has(t.id)}
                                onToggleSelect={(on) => toggleTaskSel(t.id, on)}
                                onOpen={openTask}
                                recentlyChanged={t.id === lastChangedId}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DroppableList>
                    </div>

                    <div className="mt-4"><NewTaskDialog orgId={orgId} defaultSprintId={s.id} small /></div>
                  </Card>
                );
              })}
            </div>
            <Separator />
          </>
        )}

        {/* Planned */}
        <div className="text-sm font-semibold text-muted-foreground">Upcoming sprints</div>
        <div className="space-y-4">
          {planned.map((s) => {
            const list = tasksBySprint.get(s.id) ?? [];
            return (
              <Card key={s.id} className="p-5 rounded-xl">
                <SprintHeader
                  sprint={s}
                  selected={selectedSprints.has(s.id)}
                  onToggleSelect={(on) => setSelectedSprints(prev => { const n = new Set(prev); on ? n.add(s.id) : n.delete(s.id); return n; })}
                  onStart={() => { }}
                  onComplete={() => { }}
                  onRename={(name) => updateSprint.mutate({ orgId, sprintId: s.id, name })}
                />
                <div className="mt-3">
                  <DroppableList id={`sprint:${s.id}`}>
                    <SortableContext items={list.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      <div className="divide-y rounded-md bg-card">
                        {list.map((t) => (
                          <TaskRow
                            key={t.id}
                            task={t}
                            columns={metaQ.data?.columns ?? []}
                            assignees={metaQ.data?.assignees ?? []}
                            selected={selectedTasks.has(t.id)}
                            onToggleSelect={(on) => toggleTaskSel(t.id, on)}
                            onOpen={openTask}
                            dragHandleProps={/* @ts-ignore */{}}
                            recentlyChanged={t.id === lastChangedId}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DroppableList>
                </div>
                <div className="mt-4">
                  <NewTaskDialog orgId={orgId} defaultSprintId={s.id} small />
                </div>
              </Card>
            );
          })}
        </div>

        {/* Backlog bucket */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Backlog</div>
            <Badge variant="outline">{backlogItems.length}</Badge>
          </div>
          <Card className="p-4 rounded-xl">
            <DroppableList id={`sprint:${BACKLOG_ID}`}>
              <SortableContext items={backlogItems.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="divide-y rounded-md bg-card">
                  {backlogItems.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      columns={metaQ.data?.columns ?? []}
                      assignees={metaQ.data?.assignees ?? []}
                      selected={selectedTasks.has(t.id)}
                      onToggleSelect={(on) => toggleTaskSel(t.id, on)}
                      onOpen={openTask}
                      dragHandleProps={/* @ts-ignore */{}}
                      recentlyChanged={t.id === lastChangedId}
                    />
                  ))}
                </div>
              </SortableContext>
            </DroppableList>
            <div className="mt-3"><NewTaskDialog orgId={orgId} defaultSprintId={null} small /></div>
          </Card>
        </div>

        {/* Ghost while dragging */}
        <DragOverlay dropAnimation={null}>
          {dragging ? (
            <div className="px-2 py-2 rounded-md border bg-card">{dragging.title}</div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Drawer */}
      <TaskDrawer
        taskId={selectedTaskId}
        orgId={orgId}
        open={drawerOpen}
        onOpenChange={(v) => { setDrawerOpen(v); if (!v) setSelectedTaskId(null); }}
      />
    </div>
  );
}
