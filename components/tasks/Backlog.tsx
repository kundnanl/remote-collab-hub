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
import TaskCard from "@/components/tasks/TaskCard";
import TaskDrawer from "@/components/tasks/TaskDrawer";
import { SprintCreateDialog } from "@/components/tasks/SprintCreateDialog";
import {
  DndContext,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Task = RouterOutputs["tasks"]["list"][number];
type Sprint = RouterOutputs["sprints"]["list"][number];

const BACKLOG_ID = "backlog";

function TaskSortable({
  task,
  onTaskClick,
}: {
  task: Task;
  onTaskClick: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  
  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard 
        task={task} 
        onClick={onTaskClick}
        dragHandleProps={{
          attributes: attributes || {},
          listeners: listeners || {}
        }}
      />
    </div>
  );
}

// --- Droppable list ---
function DroppableList({
  droppableId,
  items,
  onTaskClick,
}: {
  droppableId: string;
  items: Task[];
  onTaskClick: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: droppableId });
  return (
    <div ref={setNodeRef} className="min-h-[12px] space-y-2">
      <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {items.map((t) => (
          <TaskSortable key={t.id} task={t} onTaskClick={onTaskClick} />
        ))}
      </SortableContext>
    </div>
  );
}

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

  const sprintsQ = trpc.sprints.list.useQuery(
    { orgId },
    { initialData: initialSprints }
  );
  const tasksQ = trpc.tasks.list.useQuery(
    { orgId },
    { initialData: initialTasks, refetchOnWindowFocus: false }
  );

  // Group tasks by sprintId
  const tasksBySprint = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const s of sprintsQ.data ?? []) map.set(s.id, []);
    map.set(BACKLOG_ID, []);
    (tasksQ.data ?? []).forEach((t) => {
      const key = t.sprintId ?? BACKLOG_ID;
      map.get(key)?.push(t);
    });
    for (const [k, arr] of map) {
      map.set(
        k,
        arr
          .slice()
          .sort(
            (a, b) =>
              a.position - b.position ||
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
      );
    }
    return map;
  }, [sprintsQ.data, tasksQ.data]);

  // Mutations
  const moveToSprint = trpc.tasks.moveToSprint.useMutation({
    onMutate: async (vars) => {
      await utils.tasks.list.cancel({ orgId });
      const prev = utils.tasks.list.getData({ orgId });

      utils.tasks.list.setData({ orgId }, (old) => {
        if (!old) return old;

        const movingTaskIndex = old.findIndex((t) => t.id === vars.taskId);
        if (movingTaskIndex === -1) return old;

        const movingTask = old[movingTaskIndex];
        const currentSprintId = movingTask.sprintId ?? null;
        const targetSprintId = vars.toSprintId ?? null;

        const allTasks = [...old];

        const targetSprintTasks = allTasks
          .filter(
            (t) => (t.sprintId ?? null) === targetSprintId && t.id !== vars.taskId
          )
          .sort(
            (a, b) =>
              a.position - b.position ||
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

        const updatedTargetTasks = [...targetSprintTasks];
        const insertIndex = Math.min(vars.toIndex, updatedTargetTasks.length);
        updatedTargetTasks.splice(insertIndex, 0, {
          ...movingTask,
          sprintId: vars.toSprintId,
        });

        const repositionedTargetTasks = updatedTargetTasks.map((task, index) => ({
          ...task,
          position: index,
        }));

        const otherTasks = allTasks.filter(
          (t) => (t.sprintId ?? null) !== targetSprintId && t.id !== vars.taskId
        );

        if (currentSprintId === targetSprintId) {
          const sameSprintTasks = allTasks
            .filter((t) => (t.sprintId ?? null) === targetSprintId)
            .sort(
              (a, b) =>
                a.position - b.position ||
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

          const taskIds = sameSprintTasks.map((t) => t.id);
          const currentIndex = taskIds.indexOf(vars.taskId);
          const newOrder = arrayMove(taskIds, currentIndex, vars.toIndex);

          const reorderedTasks = newOrder.map((id, index) => {
            const task = sameSprintTasks.find((t) => t.id === id)!;
            return {
              ...task,
              position: index,
            };
          });

          return [...otherTasks, ...reorderedTasks];
        }

        return [...otherTasks, ...repositionedTargetTasks];
      });

      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.tasks.list.setData({ orgId }, ctx.prev);
    },
    onSettled: () => {
      utils.tasks.list.invalidate({ orgId });
    },
  });

  // DnD
  const [dragging, setDragging] = useState<Task | null>(null);

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

    let toSprintId: string | null;
    let toIndex = 0;

    if (targetId.startsWith("sprint:")) {
      const raw = targetId.slice("sprint:".length);
      toSprintId = raw === BACKLOG_ID ? null : raw;
      const list = tasksBySprint.get(toSprintId ?? BACKLOG_ID) ?? [];
      toIndex = list.length;
    } else {
      const targetTask = tasksQ.data?.find((t) => t.id === targetId);
      if (!targetTask) return;
      toSprintId = targetTask.sprintId ?? null;
      const list = tasksBySprint.get(toSprintId ?? BACKLOG_ID) ?? [];
      const idx = list.findIndex((t) => t.id === targetId);
      toIndex = idx === -1 ? list.length : idx;
    }

    const movingTask = tasksQ.data?.find((t) => t.id === taskId);
    if (!movingTask) return;

    const currentSprintId = movingTask.sprintId ?? null;
    const currentList = tasksBySprint.get(currentSprintId ?? BACKLOG_ID) ?? [];
    const currentIndex = currentList.findIndex((t) => t.id === taskId);

    if (currentSprintId === toSprintId && currentIndex === toIndex) {
      return;
    }

    moveToSprint.mutate({ taskId, toSprintId, toIndex });
  }

  // UI state
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const active = (sprintsQ.data ?? []).filter((s) => s.status === "ACTIVE");
  const planned = (sprintsQ.data ?? []).filter((s) => s.status === "PLANNED");
  const [createOpen, setCreateOpen] = useState(false);
  const backlogItems = tasksBySprint.get(BACKLOG_ID) ?? [];

  const handleTaskClick = (id: string) => {
    setSelectedTask(id);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Backlog</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Create Sprint
          </Button>
          <SprintCreateDialog orgId={orgId} open={createOpen} setOpen={setCreateOpen} />
          <NewTaskDialog orgId={orgId} defaultSprintId={null} small />
        </div>
      </div>

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {active.length > 0 && (
          <>
            <div className="text-sm font-semibold text-muted-foreground">
              Active sprint
            </div>
            <div className="space-y-3">
              {active.map((s) => (
                <Card key={s.id} className="p-4 space-y-3">
                  <div className="flex justify-between">
                    <div className="font-medium">{s.name}</div>
                    <Badge>{s.status.toLowerCase()}</Badge>
                  </div>
                  <DroppableList
                    droppableId={`sprint:${s.id}`}
                    items={tasksBySprint.get(s.id) ?? []}
                    onTaskClick={handleTaskClick}
                  />
                  <NewTaskDialog orgId={orgId} defaultSprintId={s.id} small />
                </Card>
              ))}
            </div>
            <Separator />
          </>
        )}

        <div className="text-sm font-semibold text-muted-foreground">
          Upcoming sprints
        </div>
        <div className="space-y-3">
          {planned.map((s) => (
            <Card key={s.id} className="p-4 space-y-3">
              <div className="flex justify-between">
                <div className="font-medium">{s.name}</div>
                <Badge>{s.status.toLowerCase()}</Badge>
              </div>
              <DroppableList
                droppableId={`sprint:${s.id}`}
                items={tasksBySprint.get(s.id) ?? []}
                onTaskClick={handleTaskClick}
              />
              <NewTaskDialog orgId={orgId} defaultSprintId={s.id} small />
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          <div className="font-medium">Backlog</div>
          <Card className="p-4">
            <DroppableList
              droppableId={`sprint:${BACKLOG_ID}`}
              items={backlogItems}
              onTaskClick={handleTaskClick}
            />
            <NewTaskDialog orgId={orgId} defaultSprintId={null} small />
          </Card>
        </div>

        <DragOverlay>
          {dragging ? <TaskCard task={dragging} disableClick /> : null}
        </DragOverlay>
      </DndContext>

      <TaskDrawer
        taskId={selectedTask}
        orgId={orgId}
        open={drawerOpen}
        onOpenChange={(v) => {
          setDrawerOpen(v);
          if (!v) setSelectedTask(null);
        }}
      />
    </div>
  );
}
  