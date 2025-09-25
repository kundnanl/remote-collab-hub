"use client";

import * as React from "react";
import { trpc } from "@/server/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

export function SprintDialog({
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
  const [startDate, setStartDate] = React.useState<Date | undefined>();
  const [endDate, setEndDate] = React.useState<Date | undefined>();
  const [velocity, setVelocity] = React.useState<number | undefined>();

  const create = trpc.sprints.create.useMutation({
    onSuccess: () => {
      utils.sprints.list.invalidate({ orgId });
      setOpen(false);
      setName("");
      setGoal("");
      setStartDate(undefined);
      setEndDate(undefined);
      setVelocity(undefined);
    },
  });

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

          {/* Start Date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP") : "Pick start date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* End Date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "PPP") : "Pick end date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Input
            placeholder="Velocity target (pts)"
            type="number"
            value={velocity ?? ""}
            onChange={(e) => setVelocity(Number(e.target.value) || undefined)}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={() =>
              create.mutate({
                orgId,
                name,
                goal,
                startDate: startDate?.toISOString(),
                endDate: endDate?.toISOString(),
                velocityTarget: velocity,
              })
            }
            disabled={create.isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
