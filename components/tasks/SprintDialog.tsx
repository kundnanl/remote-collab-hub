"use client";

import * as React from "react";
import { trpc } from "@/server/client";
import type { RouterOutputs } from "@/server/client";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";

type Sprint = RouterOutputs["sprints"]["list"][number];

export function SprintDialog({
  orgId,
  mode,
  sprintId,
  open,
  setOpen,
}: {
  orgId: string;
  mode: "create" | "edit";
  sprintId?: string | null;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const sprints = trpc.sprints.list.useQuery(
    { orgId },
    { enabled: mode === "edit" && !!sprintId }
  );

  const existing: Sprint | null =
    mode === "edit"
      ? (sprints.data ?? []).find((s) => s.id === sprintId) ?? null
      : null;

  const [name, setName] = React.useState(existing?.name ?? "");
  const [goal, setGoal] = React.useState(existing?.goal ?? "");
  const [startDate, setStartDate] = React.useState<Date | undefined>(
    existing?.startDate ? new Date(existing.startDate) : undefined
  );
  const [endDate, setEndDate] = React.useState<Date | undefined>(
    existing?.endDate ? new Date(existing.endDate) : undefined
  );
  const [velocity, setVelocity] = React.useState<number | "">(existing?.velocityTarget ?? "");

  React.useEffect(() => {
    if (existing) {
      setName(existing.name);
      setGoal(existing.goal ?? "");
      setStartDate(existing.startDate ? new Date(existing.startDate) : undefined);
      setEndDate(existing.endDate ? new Date(existing.endDate) : undefined);
      setVelocity(existing.velocityTarget ?? "");
    }
    if (mode === "create") {
      setName("");
      setGoal("");
      setStartDate(undefined);
      setEndDate(undefined);
      setVelocity("");
    }
  }, [existing?.id, mode, open]);

  const create = trpc.sprints.create.useMutation({
    onSuccess: () => {
      utils.sprints.list.invalidate({ orgId });
      setOpen(false);
    },
  });

  const update = trpc.sprints.update.useMutation({
    onSuccess: () => {
      utils.sprints.list.invalidate({ orgId });
      setOpen(false);
    },
  });

  const saving = create.isPending || update.isPending;
  const canSave =
    name.trim().length > 0 &&
    (!startDate || !endDate || startDate <= endDate);

  const handleSave = () => {
    if (!canSave) return;
    if (mode === "create") {
      create.mutate({
        orgId,
        name: name.trim(),
        goal: goal.trim() || undefined,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        velocityTarget: typeof velocity === "number" ? velocity : undefined,
      });
    } else if (existing) {
      update.mutate({
        orgId,
        sprintId: existing.id,
        name: name.trim(),
        goal: goal.trim() || undefined,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        velocityTarget: typeof velocity === "number" ? velocity : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create Sprint" : "Edit Sprint"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input
              placeholder="Sprint 10 — Integration & polish"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Goal */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Goal</label>
            <Textarea
              placeholder="What do you want to achieve in this sprint?"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">End date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Velocity */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Velocity target (optional)</label>
            <Input
              type="number"
              min={0}
              placeholder="Story points"
              value={velocity}
              onChange={(e) =>
                setVelocity(
                  e.currentTarget.value === "" ? "" : Number(e.currentTarget.value)
                )
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create Sprint" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
