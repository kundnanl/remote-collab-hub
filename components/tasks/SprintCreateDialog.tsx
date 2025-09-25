// components/tasks/SprintCreateDialog.tsx
"use client";

import * as React from "react";
import { trpc } from "@/server/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateRangePicker } from "@/components/tasks/DateRangePicker";
import type { DateRange } from "react-day-picker";

export function SprintCreateDialog({
  orgId,
  open,
  setOpen,
}: {
  orgId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const utils = trpc.useUtils();

  const [name, setName] = React.useState("");
  const [goal, setGoal] = React.useState("");
  const [range, setRange] = React.useState<DateRange | undefined>(undefined);
  const [velocity, setVelocity] = React.useState<number | undefined>();

  const create = trpc.sprints.create.useMutation({
    onSuccess: () => {
      utils.sprints.list.invalidate({ orgId });
      setOpen(false);
      setName("");
      setGoal("");
      setRange(undefined);
      setVelocity(undefined);
    },
  });

  const canCreate = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Sprint</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Sprint name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            placeholder="Goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />

          <DateRangePicker value={range} onChange={setRange} placeholder="Start – End" />

          <Input
            placeholder="Velocity target (pts)"
            type="number"
            value={velocity ?? ""}
            onChange={(e) => setVelocity(Number(e.target.value) || undefined)}
          />
        </div>

        <DialogFooter>
          <Button
            disabled={!canCreate || create.isPending}
            onClick={() =>
              create.mutate({
                orgId,
                name,
                goal,
                startDate: range?.from?.toISOString(),
                endDate: range?.to?.toISOString(),
                velocityTarget: velocity,
              })
            }
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
