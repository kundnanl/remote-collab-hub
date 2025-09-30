"use client";

import * as React from "react";
import { trpc } from "@/server/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon, Trash2, X, Save } from "lucide-react";
import { TaskPriority, TaskType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Skeleton, SkeletonText, SkeletonButton } from "@/components/ui/Skeleton";

// Types mirror your schema (kept as-is)
type Task = {
  id: string; orgId: string; title: string; description: string | null;
  priority: TaskPriority; type: TaskType; position: number;
  createdBy: string; assigneeId: string | null; sprintId: string | null; columnId: string | null;
  dueDate: string | null; startDate: string | null; estimate: number | null;
  createdAt: Date; updatedAt: Date;
};

type Activity = {
  id: string;
  type: string;
  createdAt: string | Date;
  actor?: { name?: string | null } | null;
};

type UpdatableTaskFields = Pick<Task,
  'title' | 'description' | 'type' | 'priority' | 'columnId' |
  'sprintId' | 'assigneeId' | 'estimate' | 'dueDate' | 'position' | 'startDate'
>;
type PendingChanges = Partial<UpdatableTaskFields>;

function TaskDetailSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="lg:col-span-8 col-span-12 space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-9 w-2/3" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
          </div>
        </Card>
        <Card className="p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-40 w-full" />
        </Card>
        <Card className="p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <SkeletonText lines={5} />
        </Card>
        <Card className="p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <SkeletonText lines={4} />
          <div className="flex gap-2">
            <SkeletonButton />
          </div>
        </Card>
      </div>
      <div className="lg:col-span-4 col-span-12 space-y-4">
        <Card className="p-4 space-y-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Separator />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Separator />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </Card>
      </div>
    </div>
  );
}

export default function TaskDetail({
  taskId,
  standalone,
}: {
  taskId: string;
  standalone?: boolean;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();

  // Base task
  const taskQ = trpc.tasks.byId.useQuery({ taskId }, { refetchOnWindowFocus: false });

  // Meta: assignees / sprints / columns
  const metaQ = trpc.tasks.meta.useQuery({ taskId }, { refetchOnWindowFocus: false });

  // Comments & Activity
  const commentsQ = trpc.tasks.comments.list.useQuery({ taskId }, { refetchOnWindowFocus: false });
  const activityQ = trpc.tasks.activity.list.useQuery({ taskId }, { refetchOnWindowFocus: false });

  const update = trpc.tasks.update.useMutation({
    onMutate: async (vars) => {
      await utils.tasks.byId.cancel({ taskId });
      const prev = utils.tasks.byId.getData({ taskId });
      if (prev) utils.tasks.byId.setData({ taskId }, { ...prev, ...vars.data });
      return { prev };
    },
    onError: (_error, _variables, context) => {
      if (context?.prev) utils.tasks.byId.setData({ taskId }, context.prev);
    },
    onSuccess: () => setPendingChanges({}),
  });

  const addComment = trpc.tasks.comments.add.useMutation({
    onSuccess: () => {
      utils.tasks.comments.list.invalidate({ taskId });
      setComment("");
    },
  });

  const del = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      router.push("/dashboard/tasks");
    },
  });

  const t = taskQ.data;
  const meta = metaQ.data;
  const loading = taskQ.isLoading || metaQ.isLoading;

  // Local edit buffers
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState<string | null>(null);
  const [dueOpen, setDueOpen] = React.useState(false);
  const [comment, setComment] = React.useState("");

  // Pending changes
  const [pendingChanges, setPendingChanges] = React.useState<PendingChanges>({});
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  const getCurrentValue = <K extends keyof UpdatableTaskFields>(field: K): UpdatableTaskFields[K] | undefined => {
    if (Object.prototype.hasOwnProperty.call(pendingChanges, field)) return pendingChanges[field];
    return t?.[field];
  };

  React.useEffect(() => {
    if (t?.id) {
      setTitle(t.title);
      setDescription(t.description ?? "");
      setPendingChanges({});
    }
  }, [t?.id, t?.title, t?.description]);

  const handleFieldChange = <K extends keyof PendingChanges>(field: K, value: PendingChanges[K]) => {
    setPendingChanges((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!hasPendingChanges) return;
    update.mutate({ taskId, data: pendingChanges });
  };

  const handleCancel = () => {
    if (!t) return;
    setTitle(t.title);
    setDescription(t.description ?? "");
    setPendingChanges({});
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    const trimmed = value.trim();
    if (t && trimmed !== t.title) handleFieldChange("title", trimmed);
    else setPendingChanges((prev) => {
      const { title, ...rest } = prev; return rest;
    });
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    const newDesc = value.trim() || null;
    if (t && newDesc !== t.description) handleFieldChange("description", newDesc);
    else setPendingChanges((prev) => {
      const { description, ...rest } = prev; return rest;
    });
  };

  const handleSelectChange = <K extends keyof UpdatableTaskFields>(field: K, value: string) => {
    const processed = (value === "none" || value === "unassigned" ? null : value) as UpdatableTaskFields[K];
    if (t && processed !== t[field]) handleFieldChange(field, processed);
  };

  if (loading || !t) {
    return <TaskDetailSkeleton />;
  }

  return (
    <div className={cn("grid gap-6", standalone ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-12")}>
      {/* Save/Cancel Bar */}
      {hasPendingChanges && (
        <div className="col-span-12 sticky top-0 z-40 bg-background/95 backdrop-blur border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">You have unsaved changes</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={update.isPending}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={update.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {update.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="lg:col-span-8 col-span-12 space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 relative">
              <Input value={title} onChange={(e) => handleTitleChange(e.target.value)} className="text-xl font-semibold" />
              {pendingChanges.title && <div className="absolute -right-8 top-1/2 -translate-y-1/2 w-2 h-2 bg-orange-500 rounded-full" />}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{t.type.toLowerCase()}</Badge>
              <Badge>{t.priority.toLowerCase()}</Badge>
              <Button variant="destructive" size="icon" onClick={() => del.mutate({ taskId })} title="Delete task">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">Description</div>
            {pendingChanges.description !== undefined && <div className="w-2 h-2 bg-orange-500 rounded-full" />}
          </div>
          <Textarea
            placeholder="Add a description…"
            value={description ?? ""}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            className="min-h-[160px]"
          />
        </Card>

        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium">Activity</div>
          <div className="space-y-2 text-sm">
            {(activityQ.data as unknown as Activity[] ?? []).map((a) => (
              <div key={a.id} className="flex items-start gap-2">
                <div className="text-muted-foreground">
                  {a.actor?.name ?? "Someone"} • {a.type.toLowerCase()} • {new Date(a.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
            {activityQ.data?.length === 0 && <div className="text-muted-foreground">No activity yet.</div>}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium">Comments</div>
          <div className="space-y-3">
            {(commentsQ.data ?? []).map((c) => (
              <div key={c.id} className="rounded border p-2">
                <div className="text-xs text-muted-foreground">
                  {c.author?.name ?? "User"} • {new Date(c.createdAt).toLocaleString()}
                </div>
                <div className="mt-1 text-sm">{c.body}</div>
              </div>
            ))}
            {commentsQ.data?.length === 0 && <div className="text-muted-foreground text-sm">Be the first to comment.</div>}
            <div className="flex items-start gap-2">
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment…" className="min-h-[80px]" />
              <Button onClick={() => comment.trim() && addComment.mutate({ taskId, body: comment.trim() })} disabled={!comment.trim() || addComment.isPending}>
                Comment
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="lg:col-span-4 col-span-12 space-y-4">
        <Card className="p-4 space-y-4">
          <div className="text-sm font-medium">Details</div>

          {/* Column */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground">Column</div>
              {pendingChanges.columnId !== undefined && <div className="w-2 h-2 bg-orange-500 rounded-full" />}
            </div>
            <Select value={getCurrentValue("columnId") ?? "none"} onValueChange={(v) => handleSelectChange("columnId", v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {(meta?.columns ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Sprint */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground">Sprint</div>
              {pendingChanges.sprintId !== undefined && <div className="w-2 h-2 bg-orange-500 rounded-full" />}
            </div>
            <Select value={getCurrentValue("sprintId") ?? "none"} onValueChange={(v) => handleSelectChange("sprintId", v)}>
              <SelectTrigger><SelectValue placeholder="Backlog" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Backlog</SelectItem>
                {(meta?.sprints ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Type / Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">Type</div>
                {pendingChanges.type && <div className="w-2 h-2 bg-orange-500 rounded-full" />}
              </div>
              <Select value={getCurrentValue("type")} onValueChange={(v) => handleFieldChange("type", v as TaskType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[TaskType.FEATURE, TaskType.BUG, TaskType.CHORE, TaskType.DOCS].map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt.toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">Priority</div>
                {pendingChanges.priority && <div className="w-2 h-2 bg-orange-500 rounded-full" />}
              </div>
              <Select value={getCurrentValue("priority")} onValueChange={(v) => handleFieldChange("priority", v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.URGENT].map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt.toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground">Assignee</div>
              {pendingChanges.assigneeId !== undefined && <div className="w-2 h-2 bg-orange-500 rounded-full" />}
            </div>
            <Select value={getCurrentValue("assigneeId") ?? "unassigned"} onValueChange={(v) => handleSelectChange("assigneeId", v)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {(meta?.assignees ?? []).map((u) => (
                  <SelectItem key={u.clerkId} value={u.clerkId}>{u.name ?? u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estimate / Due */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">Estimate</div>
                {pendingChanges.estimate !== undefined && <div className="w-2 h-2 bg-orange-500 rounded-full" />}
              </div>
              <Input
                type="number"
                min={0}
                value={getCurrentValue("estimate") ?? ""}
                onChange={(e) => {
                  const value = e.currentTarget.value === "" ? null : Number(e.currentTarget.value);
                  handleFieldChange("estimate", value);
                }}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">Due date</div>
                {pendingChanges.dueDate !== undefined && <div className="w-2 h-2 bg-orange-500 rounded-full" />}
              </div>
              <Popover open={dueOpen} onOpenChange={setDueOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {getCurrentValue("dueDate")
                      ? format(new Date(getCurrentValue("dueDate")!), "PPP")
                      : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={getCurrentValue("dueDate") ? new Date(getCurrentValue("dueDate")!) : undefined}
                    onSelect={(d) => {
                      setDueOpen(false);
                      handleFieldChange("dueDate", d ? d.toISOString() : null);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
