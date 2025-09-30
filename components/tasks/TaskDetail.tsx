"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { format } from "date-fns";
import Link from "next/link";

import { trpc } from "@/server/client";
import { cn } from "@/lib/utils";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  Pencil, Check, Calendar as CalendarIcon, Trash2,
  ArrowDown, ArrowUp, ChevronsUp, Equal, ChevronDown, CheckCircle2, Loader2,
} from "lucide-react";

import { TaskPriority, TaskType } from "@prisma/client";

/* ----------------------------- UI helpers ----------------------------- */

const PRIORITIES = [
  { key: "LOW", label: "Low", icon: ArrowDown, className: "text-blue-500" },
  { key: "MEDIUM", label: "Medium", icon: Equal, className: "text-gray-500" },
  { key: "HIGH", label: "High", icon: ArrowUp, className: "text-amber-500" },
  { key: "URGENT", label: "Urgent", icon: ChevronsUp, className: "text-red-500" },
] as const;

function useSuccessFlash(ms = 800) {
  const [on, setOn] = React.useState(false);
  const timer = React.useRef<number | null>(null);
  const trigger = React.useCallback(() => {
    setOn(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOn(false), ms);
  }, [ms]);
  React.useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  return { on, trigger };
}

function SectionCard({
  children,
  flash,
  className,
}: { children: React.ReactNode; flash?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      layout
      initial={false}
      animate={flash ? { boxShadow: "0 0 0 2px rgba(16,185,129,0.6)" } : { boxShadow: "0 0 0 0 transparent" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
    >
      {children}
    </motion.div>
  );
}

function TinySaved({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="inline-flex items-center gap-1 text-emerald-600 text-xs"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Saved
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SkeletonShell() {
  return (
    <div className="grid grid-cols-12 gap-6">
      <Card className="col-span-12 lg:col-span-8 p-6 min-h-[200px] animate-pulse" />
      <Card className="col-span-12 lg:col-span-4 p-6 min-h-[200px] animate-pulse" />
    </div>
  );
}

/* ============================== Page ============================== */

export default function TaskDetail({
  taskId,
  standalone,
}: {
  taskId: string;
  standalone?: boolean;
}) {
  const utils = trpc.useUtils();

  const taskQ = trpc.tasks.byId.useQuery({ taskId }, { refetchOnWindowFocus: false });
  const metaQ = trpc.tasks.meta.useQuery({ taskId }, { refetchOnWindowFocus: false });
  const commentsQ = trpc.tasks.comments.list.useQuery({ taskId }, { refetchOnWindowFocus: false });
  const activityQ = trpc.tasks.activity.list.useQuery({ taskId }, { refetchOnWindowFocus: false });

  // success flashes (per section)
  const titleFx = useSuccessFlash();
  const descFx = useSuccessFlash();
  const detailsFx = useSuccessFlash();

  const update = trpc.tasks.update.useMutation({
    onMutate: async (vars) => {
      await utils.tasks.byId.cancel({ taskId });
      const prev = utils.tasks.byId.getData({ taskId });
      if (prev) utils.tasks.byId.setData({ taskId }, { ...prev, ...vars.data });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) utils.tasks.byId.setData({ taskId }, ctx.prev); },
    onSuccess: (_d, vars) => {
      // pick which section to flash based on fields
      const keys = Object.keys(vars.data ?? {});
      if (keys.some(k => ["title"].includes(k))) titleFx.trigger();
      else if (keys.some(k => ["description"].includes(k))) descFx.trigger();
      else detailsFx.trigger();
      utils.tasks.list.invalidate().catch(() => { });
    },
  });

  const addComment = trpc.tasks.comments.add.useMutation({
    onSuccess: () => {
      utils.tasks.comments.list.invalidate({ taskId }).catch(() => { });
      setNewComment("");
    },
  });

  const del = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate().catch(() => { });
      if (typeof window !== "undefined") window.location.href = "/dashboard/tasks";
    },
  });

  const t = taskQ.data;
  const meta = metaQ.data;

  // local buffers
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState<string>("");
  const [dueOpen, setDueOpen] = React.useState(false);
  const [newComment, setNewComment] = React.useState("");

  React.useEffect(() => {
    if (t) {
      setTitle(t.title);
      setDesc(t.description ?? "");
    }
  }, [t?.id]);

  const assignee = (meta?.assignees ?? []).find(a => a.clerkId === t?.assigneeId) ?? null;
  const columnTitle = (meta?.columns ?? []).find(c => c.id === t?.columnId)?.title ?? "—";
  const sprintName = (meta?.sprints ?? []).find(s => s.id === t?.sprintId)?.name ?? "Backlog";

  if (!t || taskQ.isLoading || metaQ.isLoading) return <SkeletonShell />;

  /* -------------------- update helpers -------------------- */
  const saveTitle = () => {
    const next = title.trim();
    setEditingTitle(false);
    if (!next || next === t.title) { setTitle(t.title); return; }
    update.mutate({ taskId, data: { title: next } });
  };
  const saveDesc = () => {
    const next = (desc ?? "").trim();
    const normalized = next.length ? next : null;
    if (normalized === (t.description ?? null)) return;
    update.mutate({ taskId, data: { description: normalized } });
  };
  const setPriority = (p: TaskPriority) => update.mutate({ taskId, data: { priority: p } });
  const setColumn = (columnId: string | null) => update.mutate({ taskId, data: { columnId } });
  const setSprint = (sprintId: string | null) => update.mutate({ taskId, data: { sprintId } });
  const setType = (type: TaskType) => update.mutate({ taskId, data: { type } });
  const setAssignee = (assigneeId: string | null) => update.mutate({ taskId, data: { assigneeId } });
  const setEstimate = (estimate: number | null) => update.mutate({ taskId, data: { estimate } });
  const setDueDate = (iso: string | null) => update.mutate({ taskId, data: { dueDate: iso } });

  /* ------------------------------- UI -------------------------------- */

  return (
    <div className={cn("grid gap-6", standalone ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-12")}>
      {/* LEFT: Title + Description + Activity + Comments */}
      <div className="col-span-12 lg:col-span-8 space-y-4">
        {/* Title / top bar */}
        <SectionCard flash={titleFx.on} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {editingTitle ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle();
                    if (e.key === "Escape") { setTitle(t.title); setEditingTitle(false); }
                  }}
                  className="text-xl font-semibold h-10"
                />
              ) : (
                <div className="group flex items-center gap-2">
                  <h1 className="text-xl font-semibold leading-7">{t.title}</h1>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-muted"
                    onClick={() => setEditingTitle(true)}
                    aria-label="Edit title"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <TinySaved show={titleFx.on} />
                </div>
              )}
              <div className="mt-1">
                <Link
                  href={`/dashboard/tasks/${t.id}`}
                  target="_blank"
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Open in new tab
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Type */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1">
                    {t.type.toLowerCase()}
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {[TaskType.FEATURE, TaskType.BUG, TaskType.CHORE, TaskType.DOCS].map((tp) => (
                    <DropdownMenuItem key={tp} onClick={() => setType(tp)}>
                      {tp.toLowerCase()}
                      {t.type === tp && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Priority */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="secondary" className="gap-1">
                    {(PRIORITIES.find(p => p.key === t.priority)?.label ?? t.priority).toLowerCase()}
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {PRIORITIES.map((p) => (
                    <DropdownMenuItem key={p.key} onClick={() => setPriority(p.key as TaskPriority)}>
                      <p.icon className={cn("mr-2 h-4 w-4", p.className)} />
                      {p.label}
                      {t.priority === p.key && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Delete */}
              <Button variant="destructive" size="icon" onClick={() => del.mutate({ taskId })} title="Delete task">
                {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </SectionCard>

        {/* Description */}
        <SectionCard flash={descFx.on} className="p-5 bg-card">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Description</div>
            <TinySaved show={descFx.on} />
          </div>
          <Textarea
            value={desc}
            placeholder="Add a description…"
            className="min-h-[160px] mt-2"
            onChange={(e) => setDesc(e.target.value)}
            onBlur={saveDesc}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </SectionCard>

        {/* Activity */}
        <Card className="p-5 rounded-xl border bg-card space-y-3">
          <div className="text-sm font-medium">Activity</div>
          <div className="space-y-2 text-sm">
            <AnimatePresence initial={false}>
              {(activityQ.data ?? []).map((a) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-muted-foreground"
                >
                  {(a.actor?.name ?? "Someone")} • {a.type.toLowerCase()} • {new Date(a.createdAt).toLocaleString()}
                </motion.div>
              ))}
            </AnimatePresence>
            {(activityQ.data?.length ?? 0) === 0 && <div className="text-muted-foreground">No activity yet.</div>}
          </div>
        </Card>

        {/* Comments */}
        <Card className="p-5 rounded-xl border bg-card space-y-3">
          <div className="text-sm font-medium">Comments</div>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {(commentsQ.data ?? []).map((c) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="rounded border p-2"
                >
                  <div className="text-xs text-muted-foreground">
                    {c.author?.name ?? "User"} • {new Date(c.createdAt).toLocaleString()}
                  </div>
                  <div className="mt-1 text-sm">{c.body}</div>
                </motion.div>
              ))}
            </AnimatePresence>

            <div className="flex items-start gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment…"
                className="min-h-[80px]"
              />
              <Button
                onClick={() => {
                  const body = newComment.trim();
                  if (!body) return;
                  addComment.mutate({ taskId, body });
                }}
                disabled={!newComment.trim() || addComment.isPending}
              >
                {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Comment"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* RIGHT: Details */}
      <div className="col-span-12 lg:col-span-4 space-y-4">
        <SectionCard flash={detailsFx.on} className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Details</div>
            <TinySaved show={detailsFx.on} />
          </div>

          {/* State */}
          <div className="space-y-1 mb-3">
            <div className="text-xs text-muted-foreground">State</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>{columnTitle}</span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[12rem]">
                <DropdownMenuItem onClick={() => setColumn(null)}>
                  — {t.columnId === null && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
                {(meta?.columns ?? []).map((c) => (
                  <DropdownMenuItem key={c.id} onClick={() => setColumn(c.id)}>
                    {c.title} {t.columnId === c.id && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Sprint */}
          <div className="space-y-1 mb-3">
            <div className="text-xs text-muted-foreground">Sprint</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>{sprintName}</span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[12rem]">
                <DropdownMenuItem onClick={() => setSprint(null)}>
                  Backlog {t.sprintId === null && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
                {(meta?.sprints ?? []).map((s) => (
                  <DropdownMenuItem key={s.id} onClick={() => setSprint(s.id)}>
                    {s.name} {t.sprintId === s.id && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Separator className="my-3" />

          {/* Type */}
          <div className="space-y-1 mb-3">
            <div className="text-xs text-muted-foreground">Type</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>{t.type.toLowerCase()}</span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {[TaskType.FEATURE, TaskType.BUG, TaskType.CHORE, TaskType.DOCS].map((tp) => (
                  <DropdownMenuItem key={tp} onClick={() => setType(tp)}>
                    {tp.toLowerCase()}
                    {t.type === tp && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Priority */}
          <div className="space-y-1 mb-3">
            <div className="text-xs text-muted-foreground">Priority</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>{(PRIORITIES.find(p => p.key === t.priority)?.label ?? t.priority).toLowerCase()}</span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {PRIORITIES.map((p) => (
                  <DropdownMenuItem key={p.key} onClick={() => setPriority(p.key as TaskPriority)}>
                    <p.icon className={cn("mr-2 h-4 w-4", p.className)} />
                    {p.label}
                    {t.priority === p.key && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Assignee */}
          <div className="space-y-1 mb-3">
            <div className="text-xs text-muted-foreground">Assignee</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    {assignee ? (
                      <>
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarImage src={assignee.imageUrl ?? undefined} />
                          <AvatarFallback>{assignee.name?.charAt(0) ?? "U"}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{assignee.name ?? assignee.email}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-[280px] overflow-auto">
                <DropdownMenuItem onClick={() => setAssignee(null)}>
                  Unassigned {t.assigneeId === null && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
                {(meta?.assignees ?? []).map((u) => (
                  <DropdownMenuItem key={u.clerkId} onClick={() => setAssignee(u.clerkId)}>
                    <Avatar className="h-5 w-5 mr-2">
                      <AvatarImage src={u.imageUrl ?? undefined} />
                      <AvatarFallback>{u.name?.charAt(0) ?? "U"}</AvatarFallback>
                    </Avatar>
                    {u.name ?? u.email}
                    {t.assigneeId === u.clerkId && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Estimate & Due date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Estimate</div>
              <Input
                type="number"
                min={0}
                value={t.estimate ?? ""}
                onChange={(e) => {
                  const val = e.currentTarget.value === "" ? null : Number(e.currentTarget.value);
                  setEstimate(val);
                }}
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Due date</div>
              <Popover open={dueOpen} onOpenChange={setDueOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start overflow-hidden text-ellipsis whitespace-nowrap"
                  >
                    <CalendarIcon className="h-4 w-4 shrink-0 mr-2" />
                    <span className="truncate">
                      {t.dueDate ? format(new Date(t.dueDate), "PPP") : "Select date"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={t.dueDate ? new Date(t.dueDate) : undefined}
                    onSelect={(d) => { setDueOpen(false); setDueDate(d ? d.toISOString() : null); }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
