"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { trpc } from "@/server/client";
import type { RouterOutputs } from "@/server/client";
import { TaskPriority, TaskType } from "@prisma/client";

type Board = NonNullable<RouterOutputs["boards"]["getDefault"]>;

export function NewTaskDialog({ orgId, defaultColumnId, small }: { orgId: string; defaultColumnId?: string; small?: boolean }) {
  const utils = trpc.useUtils();
  const boardQ = trpc.boards.getDefault.useQuery({ orgId }); // to list columns

  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [columnId, setColumnId] = React.useState<string | undefined>(defaultColumnId);
  const [priority, setPriority] = React.useState<TaskPriority>(TaskPriority.MEDIUM);
  const [type, setType] = React.useState<TaskType>(TaskType.FEATURE);

  const create = trpc.tasks.create.useMutation({
    onSuccess: (task) => {
      utils.tasks.list.setData({ orgId }, (old) => (old ? [...old, task] : [task]));
      setTitle("");
      setOpen(false);
    },
  });

  const cols = (boardQ.data?.columns ?? []) as Board["columns"];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {small ? (
          <Button size="sm" variant="outline">New</Button>
        ) : (
          <Button>New task</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short, actionable title"
              maxLength={140}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Column</label>
              <Select value={columnId} onValueChange={(v) => setColumnId(v)}>
                <SelectTrigger><SelectValue placeholder="Choose column" /></SelectTrigger>
                <SelectContent>
                  {cols.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TaskPriority.LOW}>Low</SelectItem>
                  <SelectItem value={TaskPriority.MEDIUM}>Medium</SelectItem>
                  <SelectItem value={TaskPriority.HIGH}>High</SelectItem>
                  <SelectItem value={TaskPriority.URGENT}>Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TaskType.FEATURE}>Feature</SelectItem>
                  <SelectItem value={TaskType.BUG}>Bug</SelectItem>
                  <SelectItem value={TaskType.CHORE}>Chore</SelectItem>
                  <SelectItem value={TaskType.DOCS}>Docs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() =>
              create.mutate({
                orgId,
                title: title.trim(),
                columnId: columnId ?? null,
                priority,
                type,
              })
            }
            disabled={!title.trim() || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
