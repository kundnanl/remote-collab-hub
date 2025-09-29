"use client";

import * as React from "react";
import { trpc } from "@/server/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export function NewTaskDialog({
  orgId,
  defaultColumnId,
  defaultSprintId,
  small,
}: {
  orgId: string;
  defaultColumnId?: string;
  defaultSprintId?: string | null;
  small?: boolean;
}) {
  const utils = trpc.useUtils();
  const boardQ = trpc.boards.getDefault.useQuery({ orgId });

  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState<"FEATURE" | "BUG" | "CHORE" | "DOCS">("FEATURE");
  const [priority, setPriority] = React.useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [columnId, setColumnId] = React.useState<string | undefined>(defaultColumnId);

  const create = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate({ orgId });
      setTitle("");
      setType("FEATURE");
      setPriority("MEDIUM");
      setColumnId(defaultColumnId);
      setOpen(false);
    },
  });

  const cols = boardQ.data?.columns ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {small ? (
          <Button size="sm" variant="outline">+ Task</Button>
        ) : (
          <Button>New Task</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
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
            {/* Column */}
            {!defaultColumnId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Column</label>
                <Select
                  value={columnId}
                  onValueChange={(v) => setColumnId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose column" />
                  </SelectTrigger>
                  <SelectContent>
                    {cols.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Priority */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as "LOW" | "MEDIUM" | "HIGH" | "URGENT")}
              >
                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "FEATURE" | "BUG" | "CHORE" | "DOCS")}
              >
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FEATURE">Feature</SelectItem>
                  <SelectItem value="BUG">Bug</SelectItem>
                  <SelectItem value="CHORE">Chore</SelectItem>
                  <SelectItem value="DOCS">Docs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!title.trim() || create.isPending}
            onClick={() =>
              create.mutate({
                orgId,
                title: title.trim(),
                type,
                priority,
                columnId: columnId ?? defaultColumnId ?? null,
                sprintId: defaultSprintId ?? null,
              })
            }
          >
            {create.isPending ? "Creating…" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
}
