"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/server/client";
import type { RouterOutputs } from "@/server/client";
import { Pencil, ArrowUp, ArrowDown, ChevronsUp, ChevronDown, Check, Equal, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";

type Task = RouterOutputs["tasks"]["list"][number];
type Column = RouterOutputs["tasks"]["orgMeta"]["columns"][number];
type Assignee = RouterOutputs["tasks"]["orgMeta"]["assignees"][number];

const PRIORITIES = [
  { key: "LOW", label: "Low", icon: ArrowDown, className: "text-blue-500" },
  { key: "MEDIUM", label: "Medium", icon: Equal, className: "text-gray-500" },
  { key: "HIGH", label: "High", icon: ArrowUp, className: "text-amber-500" },
  { key: "URGENT", label: "Urgent", icon: ChevronsUp, className: "text-red-500" },
] as const;

export function TaskRow({
  task,
  columns,
  assignees,
  selected,
  onToggleSelect,
  onOpen,
  recentlyChanged = false,
}: {
  task: Task;
  columns: Column[];
  assignees: Assignee[];
  selected: boolean;
  onToggleSelect: (checked: boolean) => void;
  onOpen: (id: string) => void;
  recentlyChanged?: boolean;
}) {
  const utils = trpc.useUtils();
  const update = trpc.tasks.update.useMutation({
    onMutate: async (vars) => {
      await utils.tasks.list.cancel({ orgId: task.orgId });
      const prev = utils.tasks.list.getData({ orgId: task.orgId });
      utils.tasks.list.setData({ orgId: task.orgId }, (old) =>
        old ? old.map((t) => (t.id === task.id ? { ...t, ...vars.data } : t)) : old
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) utils.tasks.list.setData({ orgId: task.orgId }, ctx.prev);
    },
    onSettled: () => {
      utils.tasks.list.invalidate({ orgId: task.orgId });
    },
  });

  const { setNodeRef, attributes, listeners, transform, transition } = useSortable({ id: task.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assignee = useMemo(
    () => assignees.find((u) => u.clerkId === task.assigneeId),
    [assignees, task.assigneeId]
  );


  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { setTitle(task.title); }, [task.title]);

  const priority = useMemo(
    () => PRIORITIES.find((p) => p.key === task.priority) ?? PRIORITIES[1],
    [task.priority]
  );

  const commitTitle = () => {
    const next = title.trim();
    setEditing(false);
    if (next && next !== task.title) update.mutate({ taskId: task.id, data: { title: next } });
    else setTitle(task.title);
  };

  const down = useRef<{ x: number; y: number } | null>(null);
  const handlePointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY };
  };
  const handleRowClick = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest("[data-noopen]")) return;
    if (down.current) {
      const dx = Math.abs(e.clientX - down.current.x);
      const dy = Math.abs(e.clientY - down.current.y);
      if (dx > 3 || dy > 3) return;
    }
    onOpen(task.id);
  };

  const ringClass = recentlyChanged ? "ring-2 ring-emerald-400" : "ring-0";

  // little helper instead of spread
  const stopClick = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <motion.div
      layout
      ref={setNodeRef}
      style={style}
      className={cn(
        "group grid grid-cols-[28px_1fr_auto_auto_auto] items-center gap-3 px-2 py-2 border-b last:border-0 bg-card",
        "hover:bg-accent/40 rounded-md transition-colors cursor-grab active:cursor-grabbing",
        ringClass
      )}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onClick={handleRowClick}
    >
      {/* checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onToggleSelect(e.currentTarget.checked)}
        className="size-4 rounded border-muted-foreground/30"
        data-noopen
        onClick={stopClick}
        onPointerDown={stopClick}
      />

      {/* title + edit */}
      <div className="min-w-0 flex items-center gap-2">
        {editing ? (
          <Input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") { setTitle(task.title); setEditing(false); }
            }}
            className="h-7 text-sm"
            data-noopen
            onClick={stopClick}
            onPointerDown={stopClick}
          />
        ) : (
          <>
            <Link
              href={`/dashboard/tasks/${task.id}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()} // don’t trigger drawer
              className="truncate text-sm font-medium hover:underline"
            >
              {task.title}
            </Link>

            <button
              className="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-muted"
              aria-label="Edit title"
              onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              data-noopen
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {/* priority dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted"
            title="Change priority"
            data-noopen
            onClick={stopClick}
            onPointerDown={stopClick}
          >
            <priority.icon className={cn("h-4 w-4", priority.className)} />
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4}>
          {PRIORITIES.map((p) => (
            <DropdownMenuItem
              key={p.key}
              onClick={(e) => { e.stopPropagation(); update.mutate({ taskId: task.id, data: { priority: p.key as any } }); }}
              data-noopen
            >
              <p.icon className={cn("mr-2 h-4 w-4", p.className)} /> {p.label}
              {task.priority === p.key && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* state dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="inline-flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 rounded hover:bg-muted"
            title="Change state"
            data-noopen
            onClick={stopClick}
            onPointerDown={stopClick}
          >
            {columns.find((c) => c.id === task.columnId)?.title ?? "—"}
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4} className="min-w-[10rem]">
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); update.mutate({ taskId: task.id, data: { columnId: null } }); }}
            data-noopen
          >
            {'—'} {task.columnId === null && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
          {columns.map((col) => (
            <DropdownMenuItem
              key={col.id}
              onClick={(e) => { e.stopPropagation(); update.mutate({ taskId: task.id, data: { columnId: col.id } }); }}
              data-noopen
            >
              {col.title}
              {task.columnId === col.id && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* assignee */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="h-7 w-7 rounded-full border bg-muted flex items-center justify-center"
            title="Change assignee"
            data-noopen
            onClick={(e) => e.stopPropagation()}
          >
            {assignee ? (
              <Avatar className="h-6 w-6">
                <AvatarImage src={assignee.imageUrl ?? undefined} />
                <AvatarFallback>
                  {assignee.name?.charAt(0) ?? "U"}
                </AvatarFallback>
              </Avatar>
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              update.mutate({ taskId: task.id, data: { assigneeId: null } });
            }}
            data-noopen
          >
            Unassigned {task.assigneeId === null && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
          {assignees.map((u) => (
            <DropdownMenuItem
              key={u.clerkId}
              onClick={(e) => {
                e.stopPropagation();
                update.mutate({ taskId: task.id, data: { assigneeId: u.clerkId } });
              }}
              data-noopen
            >
              <Avatar className="h-5 w-5 mr-2">
                <AvatarImage src={u.imageUrl ?? undefined} />
                <AvatarFallback>{u.name?.charAt(0) ?? "U"}</AvatarFallback>
              </Avatar>
              {u.name}
              {task.assigneeId === u.clerkId && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}
